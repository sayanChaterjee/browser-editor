"use client";

type Props = {
  activeFile: string;
  setActiveFile: (file: string) => void;
};

const files = [
  { name: "index.html", label: "HTML" },
  { name: "styles.css", label: "CSS" },
  { name: "script.js", label: "JavaScript" },
  { name: "README.md", label: "Markdown" }, 
];

export default function FileExplorer({ activeFile, setActiveFile }: Props) {
  return (
    <div className="w-[220px] bg-[#252526] p-[10px] border-r border-[#333]">
      <h4 className="text-[12px] mb-2.5 text-[#ccc] font-bold">EXPLORER</h4>

      {files.map((file) => (
        <div
          key={file.name}
          className={`px-2 py-1.5 cursor-pointer rounded text-[13px] transition-colors flex items-center ${activeFile === file.name ? "bg-[#37373d]" : "hover:bg-[#2a2d2e]"}`}
          onClick={() => setActiveFile(file.name)}
        >
          {file.name === "index.html" && (
            <i className="devicon-html5-plain colored" />
          )}
          {file.name === "styles.css" && (
            <i className="devicon-css3-plain colored" />
          )}
          {file.name === "script.js" && (
            <i className="devicon-javascript-plain colored" />
          )}
          {file.name === "README.md" && (
            <span className="font-bold">📘</span>
          )}

          <span className="ml-2">{file.name}</span>
        </div>
      ))}
    </div>
  );
}
