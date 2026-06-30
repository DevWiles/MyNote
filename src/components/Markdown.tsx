import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";

/**
 * 渲染 Markdown。为各级标题按文档顺序注入锚点 id（md-h-0、md-h-1…），
 * 供笔记「大纲」面板点击定位使用。计数器每次渲染重置，渲染按文档顺序进行，
 * 故 id 序号与大纲解析出的标题序号一一对应。
 */
export default function Markdown({ children }: { children: string }) {
  const counter = { i: 0 };
  const heading =
    (Tag: "h1" | "h2" | "h3" | "h4" | "h5" | "h6") =>
    (props: { children?: React.ReactNode }) => {
      const { children, ...rest } = props as Record<string, unknown> & {
        children?: React.ReactNode;
      };
      delete rest.node;
      const idx = counter.i++;
      return (
        <Tag id={`md-h-${idx}`} {...rest}>
          {children}
        </Tag>
      );
    };

  const components: Components = {
    h1: heading("h1"),
    h2: heading("h2"),
    h3: heading("h3"),
    h4: heading("h4"),
    h5: heading("h5"),
    h6: heading("h6"),
  };

  return (
    <div className="md-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeHighlight, { detect: true, ignoreMissing: true }]]}
        components={components}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
