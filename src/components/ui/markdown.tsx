import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '../../lib/utils';

interface MarkdownProps {
  content: string;
  className?: string;
}

export function Markdown({ content, className }: MarkdownProps) {
  return (
    <div
      className={cn(
        "prose dark:prose-invert max-w-none",
        // Custom styles
        "prose-p:mt-2 prose-p:mb-2",
        "prose-li:my-1",
        "prose-headings:mb-3 prose-headings:mt-4",
        className
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Customize heading styles
          h1: ({ className, ...props }) => (
            <h1 className={cn("text-2xl font-bold", className)} {...props} />
          ),
          h2: ({ className, ...props }) => (
            <h2 className={cn("text-xl font-semibold", className)} {...props} />
          ),
          h3: ({ className, ...props }) => (
            <h3 className={cn("text-lg font-medium", className)} {...props} />
          ),
          // Customize list styles
          ul: ({ className, ...props }) => (
            <ul className={cn("list-disc list-inside", className)} {...props} />
          ),
          ol: ({ className, ...props }) => (
            <ol className={cn("list-decimal list-inside", className)} {...props} />
          ),
          // Customize link styles
          a: ({ className, ...props }) => (
            <a className={cn("text-primary hover:underline", className)} {...props} />
          ),
          // Customize code block styles
          code: ({ className, ...props }) => (
            <code className={cn("bg-muted px-1 py-0.5 rounded", className)} {...props} />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}