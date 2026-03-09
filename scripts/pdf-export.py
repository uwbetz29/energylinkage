#!/usr/bin/env python3
"""
PDF Export for EnergyLink FLEX
Takes modified drawing entities (JSON) and renders them into a new PDF.

Usage: python3 pdf-export.py <input.json> <output.pdf> [--page-width W] [--page-height H]
Input JSON: { entities, bounds, pages, metadata }
"""

import sys
import json

try:
    import fitz  # PyMuPDF
except ImportError:
    print(json.dumps({"error": "PyMuPDF not installed. Run: pip3 install PyMuPDF"}), file=sys.stdout)
    sys.exit(1)


def render_entities_to_page(page, entities, page_height):
    """Render ParsedEntity objects onto a PDF page.

    Entities use CAD coordinates (Y-up), so we flip Y back to PDF (Y-down).
    """
    shape = page.new_shape()

    for entity in entities:
        etype = entity.get("type", "")
        color_hex = entity.get("colorHex", "#000000")
        line_width = entity.get("lineWidth", 0.5)

        # Parse hex color to RGB tuple (0-1 range)
        try:
            r = int(color_hex[1:3], 16) / 255
            g = int(color_hex[3:5], 16) / 255
            b = int(color_hex[5:7], 16) / 255
            color = (r, g, b)
        except (ValueError, IndexError):
            color = (0, 0, 0)

        if etype in ("LINE", "LWPOLYLINE", "POLYLINE", "SPLINE"):
            vertices = entity.get("vertices", [])
            if len(vertices) < 2:
                continue

            # Convert to PDF coordinates (flip Y)
            points = [fitz.Point(v["x"], page_height - v["y"]) for v in vertices]

            # Draw polyline
            shape.draw_polyline(points)

            # Close if marked
            if entity.get("closed", False) and len(points) > 2:
                shape.draw_line(points[-1], points[0])

            shape.finish(color=color, width=max(line_width, 0.25))

        elif etype == "CIRCLE":
            center = entity.get("center")
            radius = entity.get("radius", 0)
            if center and radius > 0:
                cx = center["x"]
                cy = page_height - center["y"]
                shape.draw_circle(fitz.Point(cx, cy), radius)
                shape.finish(color=color, width=max(line_width, 0.25))

        elif etype == "ARC":
            center = entity.get("center")
            radius = entity.get("radius", 0)
            if center and radius > 0:
                cx = center["x"]
                cy = page_height - center["y"]
                # PyMuPDF doesn't have draw_arc directly; approximate with circle
                # TODO: implement proper arc rendering
                shape.draw_circle(fitz.Point(cx, cy), radius)
                shape.finish(color=color, width=max(line_width, 0.25))

        elif etype in ("TEXT", "MTEXT"):
            text = entity.get("text", "")
            if not text:
                continue

            ip = entity.get("insertionPoint")
            if not ip:
                continue

            font_size = entity.get("textHeight", 8)
            x = ip["x"]
            y = page_height - ip["y"]

            # Use Helvetica as default font
            try:
                shape.insert_text(
                    fitz.Point(x, y),
                    text,
                    fontsize=font_size,
                    fontname="helv",
                    color=color,
                )
            except Exception:
                # Fallback: simple text insertion via page method
                pass

    shape.commit()


def main():
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Usage: pdf-export.py <input.json> <output.pdf>"}))
        sys.exit(1)

    json_path = sys.argv[1]
    output_path = sys.argv[2]

    # Parse optional page dimensions
    page_width = None
    page_height = None
    i = 3
    while i < len(sys.argv):
        if sys.argv[i] == "--page-width" and i + 1 < len(sys.argv):
            page_width = float(sys.argv[i + 1])
            i += 2
        elif sys.argv[i] == "--page-height" and i + 1 < len(sys.argv):
            page_height = float(sys.argv[i + 1])
            i += 2
        else:
            i += 1

    # Load the entities JSON
    try:
        with open(json_path, "r") as f:
            data = json.load(f)
    except Exception as e:
        print(json.dumps({"error": f"Failed to read JSON: {str(e)}"}))
        sys.exit(1)

    entities = data.get("entities", [])
    bounds = data.get("bounds", {})
    pages = data.get("pages", [])
    metadata = data.get("metadata", {})

    # Determine page size
    if page_width and page_height:
        pw, ph = page_width, page_height
    elif pages and len(pages) > 0:
        pw = pages[0].get("width", 612)
        ph = pages[0].get("height", 792)
    else:
        # Calculate from bounds
        bmin = bounds.get("min", {"x": 0, "y": 0})
        bmax = bounds.get("max", {"x": 612, "y": 792})
        pw = bmax["x"] - bmin["x"] + 40  # margin
        ph = bmax["y"] - bmin["y"] + 40

    # Create new PDF
    doc = fitz.open()
    page = doc.new_page(width=pw, height=ph)

    # Render all entities
    render_entities_to_page(page, entities, ph)

    # Set metadata
    if metadata:
        doc.set_metadata({
            "title": metadata.get("title", "EnergyLink FLEX Export"),
            "author": metadata.get("author", ""),
            "creator": "EnergyLink FLEX",
            "subject": metadata.get("subject", ""),
        })

    # Save
    try:
        doc.save(output_path)
        doc.close()
        result = {
            "success": True,
            "outputPath": output_path,
            "entityCount": len(entities),
            "pageSize": {"width": pw, "height": ph},
        }
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({"error": f"Failed to save PDF: {str(e)}"}))
        sys.exit(1)


if __name__ == "__main__":
    main()
