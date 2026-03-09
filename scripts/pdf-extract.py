#!/usr/bin/env python3
"""
PDF Vector + Text Extractor for EnergyLink FLEX
Extracts geometry paths and dimension text from engineering PDFs,
outputting JSON in a format compatible with our ParsedEntity system.

Usage: python3 pdf-extract.py <input.pdf> [page_number]
Output: JSON to stdout with { entities, layers, bounds, texts }
"""

import sys
import json

try:
    import fitz  # PyMuPDF
except ImportError:
    print(json.dumps({"error": "PyMuPDF not installed. Run: pip3 install PyMuPDF"}), file=sys.stdout)
    sys.exit(1)


def extract_page(page, page_num):
    """Extract vector paths and text from a single PDF page."""
    entities = []
    texts = []
    handle_counter = 0

    def next_handle():
        nonlocal handle_counter
        handle_counter += 1
        return f"PDF_{page_num}_{handle_counter:05X}"

    # --- Extract vector drawings ---
    drawings = page.get_drawings()
    for d in drawings:
        items = d.get("items", [])
        if not items:
            continue

        color_tuple = d.get("color", (0, 0, 0))
        if color_tuple:
            r, g, b = [int(c * 255) for c in color_tuple]
            color_hex = f"#{r:02x}{g:02x}{b:02x}"
        else:
            color_hex = "#000000"

        width = d.get("width", 0.5)
        fill = d.get("fill")
        closed = d.get("closePath", False)

        # Collect vertices from path items
        vertices = []
        has_curves = False

        for item in items:
            op = item[0]
            if op == "l":  # line segment
                start = item[1]
                end = item[2]
                if not vertices or (abs(vertices[-1]["x"] - start.x) > 0.01 or abs(vertices[-1]["y"] - start.y) > 0.01):
                    vertices.append({"x": round(start.x, 4), "y": round(start.y, 4)})
                vertices.append({"x": round(end.x, 4), "y": round(end.y, 4)})
            elif op == "c":  # cubic bezier: (op, p1, cp1, cp2, p4)
                has_curves = True
                if len(item) >= 5:
                    p1 = item[1]
                    cp1 = item[2]
                    cp2 = item[3]
                    p4 = item[4]
                    if not vertices:
                        vertices.append({"x": round(p1.x, 4), "y": round(p1.y, 4)})
                    for t in [0.25, 0.5, 0.75, 1.0]:
                        mt = 1 - t
                        x = mt**3 * p1.x + 3*mt**2*t * cp1.x + 3*mt*t**2 * cp2.x + t**3 * p4.x
                        y = mt**3 * p1.y + 3*mt**2*t * cp1.y + 3*mt*t**2 * cp2.y + t**3 * p4.y
                        vertices.append({"x": round(x, 4), "y": round(y, 4)})
                elif len(item) >= 3:
                    # Degenerate curve — just use endpoints
                    p1 = item[1]
                    p_end = item[-1]
                    if not vertices:
                        vertices.append({"x": round(p1.x, 4), "y": round(p1.y, 4)})
                    vertices.append({"x": round(p_end.x, 4), "y": round(p_end.y, 4)})
            elif op == "qu":  # quadratic bezier: (op, p1, cp, p3)
                has_curves = True
                if len(item) >= 4:
                    p1 = item[1]
                    cp = item[2]
                    p3 = item[3]
                    if not vertices:
                        vertices.append({"x": round(p1.x, 4), "y": round(p1.y, 4)})
                    for t in [0.33, 0.67, 1.0]:
                        mt = 1 - t
                        x = mt**2 * p1.x + 2*mt*t * cp.x + t**2 * p3.x
                        y = mt**2 * p1.y + 2*mt*t * cp.y + t**2 * p3.y
                        vertices.append({"x": round(x, 4), "y": round(y, 4)})
                elif len(item) >= 3:
                    p1 = item[1]
                    p_end = item[-1]
                    if not vertices:
                        vertices.append({"x": round(p1.x, 4), "y": round(p1.y, 4)})
                    vertices.append({"x": round(p_end.x, 4), "y": round(p_end.y, 4)})

        if len(vertices) < 2:
            continue

        # Determine entity type
        if len(vertices) == 2 and not has_curves:
            etype = "LINE"
        elif has_curves:
            etype = "SPLINE"
        else:
            etype = "LWPOLYLINE"

        entity = {
            "handle": next_handle(),
            "type": etype,
            "layer": "PDF-Import",
            "vertices": vertices,
            "closed": closed,
            "page": page_num,
        }

        # Store line width as a hint (not used in current renderer but useful later)
        if width and width > 0:
            entity["lineWidth"] = round(width, 4)

        # Store color as ACI index approximation
        entity["colorHex"] = color_hex

        entities.append(entity)

    # --- Extract text with positions ---
    text_dict = page.get_text("dict")
    page_height = page.rect.height

    for block in text_dict.get("blocks", []):
        if block.get("type") != 0:  # text blocks only
            continue
        for line in block.get("lines", []):
            for span in line.get("spans", []):
                text = span.get("text", "").strip()
                if not text:
                    continue

                bbox = span.get("bbox", [0, 0, 0, 0])
                font_size = span.get("size", 10)

                # PDF coordinates: origin at top-left, Y grows downward
                # CAD coordinates: origin at bottom-left, Y grows upward
                # We'll flip Y during import on the frontend

                text_entity = {
                    "handle": next_handle(),
                    "type": "TEXT",
                    "layer": "PDF-Text",
                    "text": text,
                    "insertionPoint": {
                        "x": round(bbox[0], 4),
                        "y": round(bbox[1], 4),
                    },
                    "textHeight": round(font_size, 2),
                    "page": page_num,
                }
                entities.append(text_entity)

                # Also store in texts array for dimension detection
                texts.append({
                    "text": text,
                    "x": round(bbox[0], 4),
                    "y": round(bbox[1], 4),
                    "width": round(bbox[2] - bbox[0], 4),
                    "height": round(bbox[3] - bbox[1], 4),
                    "fontSize": round(font_size, 2),
                    "font": span.get("font", ""),
                })

    return entities, texts


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: pdf-extract.py <input.pdf> [page_number]"}))
        sys.exit(1)

    pdf_path = sys.argv[1]
    page_num = int(sys.argv[2]) if len(sys.argv) > 2 else None  # 1-based, None = all

    try:
        doc = fitz.open(pdf_path)
    except Exception as e:
        print(json.dumps({"error": f"Failed to open PDF: {str(e)}"}))
        sys.exit(1)

    all_entities = []
    all_texts = []
    global_min_x = float("inf")
    global_min_y = float("inf")
    global_max_x = float("-inf")
    global_max_y = float("-inf")

    pages_to_process = range(doc.page_count)
    if page_num is not None:
        pages_to_process = [page_num - 1]  # Convert to 0-based

    page_sizes = []
    for pi in pages_to_process:
        if pi < 0 or pi >= doc.page_count:
            continue
        page = doc[pi]
        page_sizes.append({
            "width": round(page.rect.width, 2),
            "height": round(page.rect.height, 2),
        })
        entities, texts = extract_page(page, pi + 1)
        all_entities.extend(entities)
        all_texts.extend(texts)

    # Calculate bounds from all entities
    for e in all_entities:
        if "vertices" in e:
            for v in e["vertices"]:
                global_min_x = min(global_min_x, v["x"])
                global_min_y = min(global_min_y, v["y"])
                global_max_x = max(global_max_x, v["x"])
                global_max_y = max(global_max_y, v["y"])
        if "insertionPoint" in e:
            ip = e["insertionPoint"]
            global_min_x = min(global_min_x, ip["x"])
            global_min_y = min(global_min_y, ip["y"])
            global_max_x = max(global_max_x, ip["x"])
            global_max_y = max(global_max_y, ip["y"])

    if global_min_x == float("inf"):
        global_min_x = global_min_y = 0
        global_max_x = global_max_y = 100

    result = {
        "entities": all_entities,
        "texts": all_texts,
        "bounds": {
            "min": {"x": round(global_min_x, 4), "y": round(global_min_y, 4)},
            "max": {"x": round(global_max_x, 4), "y": round(global_max_y, 4)},
        },
        "pages": page_sizes,
        "pageCount": doc.page_count,
        "metadata": {
            "title": doc.metadata.get("title", ""),
            "author": doc.metadata.get("author", ""),
            "creator": doc.metadata.get("creator", ""),
            "subject": doc.metadata.get("subject", ""),
        },
        "entityCount": len(all_entities),
        "textCount": len(all_texts),
    }

    print(json.dumps(result))
    doc.close()


if __name__ == "__main__":
    main()
