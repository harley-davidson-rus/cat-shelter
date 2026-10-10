import React from 'react';

interface ArticleContentProps {
  content: string;
}

const LINK_PATTERN = /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<]+)/gi;
const TRAILING_PUNCTUATION = /[.,!?;:]+$/;

export const ArticleContent: React.FC<ArticleContentProps> = ({ content }) => {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = LINK_PATTERN.exec(content)) !== null) {
    if (match.index > lastIndex) parts.push(content.slice(lastIndex, match.index));

    const isMarkdownLink = Boolean(match[1] && match[2]);
    const rawUrl = match[2] || match[3];
    const trailingPunctuation = isMarkdownLink ? '' : (rawUrl.match(TRAILING_PUNCTUATION)?.[0] || '');
    const url = trailingPunctuation ? rawUrl.slice(0, -trailingPunctuation.length) : rawUrl;

    parts.push(
      <a
        key={`${match.index}-${url}`}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="font-semibold text-amber-700 underline decoration-amber-400 underline-offset-2 hover:text-amber-900 break-all"
      >
        {isMarkdownLink ? match[1] : url}
      </a>,
    );
    if (trailingPunctuation) parts.push(trailingPunctuation);

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) parts.push(content.slice(lastIndex));

  return <>{parts}</>;
};
