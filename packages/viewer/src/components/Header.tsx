export function Header() {
  return (
    <header className="border-b border-border bg-card">
      <div className="container mx-auto px-4 py-4 max-w-6xl flex items-center justify-between">
        <a href="#/" className="flex items-center gap-2 text-lg font-semibold hover:text-primary transition-colors">
          <span className="text-2xl text-primary">◈</span>
          <span>Tally</span>
        </a>
        <nav className="flex gap-4">
          <a href="#/" className="text-muted-foreground hover:text-foreground transition-colors">
            Conversations
          </a>
        </nav>
      </div>
    </header>
  );
}
