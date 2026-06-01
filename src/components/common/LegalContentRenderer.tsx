import React from 'react';
import { Text, View, StyleSheet } from 'react-native';

interface Props {
  content: string;
  contentFormat?: 'plain' | 'html' | 'markdown';
}

function stripHtml(html: string): { type: 'heading' | 'paragraph' | 'list-item' | 'bold-paragraph'; text: string }[] {
  const blocks: { type: 'heading' | 'paragraph' | 'list-item' | 'bold-paragraph'; text: string }[] = [];
  const cleaned = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n\n');

  const headingRegex = /<h[1-6][^>]*>(.*?)<\/h[1-6]>/gis;
  const liRegex = /<li[^>]*>(.*?)<\/li>/gis;

  let raw = cleaned;
  const headings: { idx: number; text: string }[] = [];
  let m;
  while ((m = headingRegex.exec(html)) !== null) {
    headings.push({ idx: m.index, text: m[1].replace(/<[^>]+>/g, '').trim() });
  }
  const listItems: { idx: number; text: string }[] = [];
  while ((m = liRegex.exec(html)) !== null) {
    listItems.push({ idx: m.index, text: m[1].replace(/<[^>]+>/g, '').trim() });
  }

  const plainText = raw.replace(/<[^>]+>/g, '').trim();
  const paragraphs = plainText.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);

  for (const h of headings) {
    blocks.push({ type: 'heading', text: h.text });
  }
  for (const li of listItems) {
    blocks.push({ type: 'list-item', text: li.text });
  }

  if (blocks.length === 0) {
    for (const p of paragraphs) {
      blocks.push({ type: 'paragraph', text: p });
    }
  }

  if (blocks.length === 0 && plainText) {
    blocks.push({ type: 'paragraph', text: plainText });
  }

  return blocks;
}

function parseMarkdown(md: string): { type: 'heading' | 'paragraph' | 'list-item' | 'bold-paragraph'; text: string }[] {
  const blocks: { type: 'heading' | 'paragraph' | 'list-item' | 'bold-paragraph'; text: string }[] = [];
  const lines = md.split('\n');
  let buffer = '';

  const flushBuffer = () => {
    const trimmed = buffer.trim();
    if (trimmed) {
      blocks.push({ type: 'paragraph', text: trimmed.replace(/\*\*(.*?)\*\*/g, '$1').replace(/__(.*?)__/g, '$1').replace(/\*(.*?)\*/g, '$1').replace(/_(.*?)_/g, '$1') });
    }
    buffer = '';
  };

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (/^#{1,6}\s/.test(trimmedLine)) {
      flushBuffer();
      const text = trimmedLine.replace(/^#{1,6}\s+/, '');
      blocks.push({ type: 'heading', text });
    } else if (/^[-*+]\s/.test(trimmedLine)) {
      flushBuffer();
      const text = trimmedLine.replace(/^[-*+]\s+/, '');
      blocks.push({ type: 'list-item', text: text.replace(/\*\*(.*?)\*\*/g, '$1') });
    } else if (/^\d+\.\s/.test(trimmedLine)) {
      flushBuffer();
      const text = trimmedLine.replace(/^\d+\.\s+/, '');
      blocks.push({ type: 'list-item', text: text.replace(/\*\*(.*?)\*\*/g, '$1') });
    } else if (trimmedLine === '') {
      flushBuffer();
    } else {
      buffer += (buffer ? ' ' : '') + trimmedLine;
    }
  }
  flushBuffer();
  return blocks;
}

function parsePlain(text: string): { type: 'heading' | 'paragraph' | 'list-item' | 'bold-paragraph'; text: string }[] {
  const paragraphs = text.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  return paragraphs.map(p => ({ type: 'paragraph' as const, text: p }));
}

export default function LegalContentRenderer({ content, contentFormat = 'plain' }: Props) {
  if (!content) return null;

  let blocks: { type: string; text: string }[];
  switch (contentFormat) {
    case 'html':
      blocks = stripHtml(content);
      break;
    case 'markdown':
      blocks = parseMarkdown(content);
      break;
    default:
      blocks = parsePlain(content);
  }

  return (
    <View>
      {blocks.map((block, i) => {
        switch (block.type) {
          case 'heading':
            return (
              <Text key={i} style={styles.heading}>
                {block.text}
              </Text>
            );
          case 'list-item':
            return (
              <View key={i} style={styles.listItem}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.listText}>{block.text}</Text>
              </View>
            );
          default:
            return (
              <Text key={i} style={styles.paragraph}>
                {block.text}
              </Text>
            );
        }
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  heading: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1A1A1A',
    marginTop: 16,
    marginBottom: 6,
    lineHeight: 24,
  },
  paragraph: {
    fontSize: 14,
    fontWeight: '400',
    color: '#1A1A1A',
    lineHeight: 21,
    marginBottom: 12,
  },
  listItem: {
    flexDirection: 'row',
    paddingLeft: 8,
    marginBottom: 6,
  },
  bullet: {
    fontSize: 14,
    color: '#4C4C4C',
    marginRight: 8,
    lineHeight: 21,
  },
  listText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '400',
    color: '#1A1A1A',
    lineHeight: 21,
  },
});
