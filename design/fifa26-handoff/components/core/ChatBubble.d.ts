export interface ChatBubbleProps {
  /** Message body. */
  body: string;
  /** Author name — hidden when `mine`. */
  authorName?: string;
  /** ISO timestamp; shown as HH:MM. */
  timestamp?: string;
  /** Render as the current user's bubble — pitch green, right-aligned. */
  mine?: boolean;
  /** Optional host-city color for the author label and bubble edge. */
  authorColor?: string;
}

export function ChatBubble(props: ChatBubbleProps): JSX.Element;
