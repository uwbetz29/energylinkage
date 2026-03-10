export default function EditorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Editor has its own full-screen chrome — skip the standard app layout
  return <>{children}</>;
}
