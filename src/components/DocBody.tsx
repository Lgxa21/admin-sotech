// Muestra el texto de un documento: "## " es un subtítulo, "- " un punto de lista, el resto párrafos.
export default function DocBody({ text }: { text: string }) {
  const blocks: React.ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length) blocks.push(<ul key={blocks.length} className="grid list-disc gap-1.5 pl-5 marker:text-muted">{list.map((l, i) => <li key={i}>{l}</li>)}</ul>);
    list = [];
  };
  for (const raw of text.replace(/\r/g, "").split("\n")) {
    const line = raw.trimEnd();
    if (line.startsWith("- ")) { list.push(line.slice(2)); continue; }
    flush();
    if (line.startsWith("## ")) blocks.push(<h3 key={blocks.length} className="h2 mt-3">{line.slice(3)}</h3>);
    else if (line.trim()) blocks.push(<p key={blocks.length}>{line}</p>);
  }
  flush();
  return <div className="grid max-w-[68ch] gap-3 text-[15px] leading-relaxed">{blocks}</div>;
}
