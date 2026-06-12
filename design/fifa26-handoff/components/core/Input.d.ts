export interface InputProps {
  value?: string;
  defaultValue?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  type?: "text" | "email" | "password" | "search" | "number";
  /** Adds a leading inline label / icon. */
  prefix?: React.ReactNode;
  /** Adds a trailing inline element. */
  suffix?: React.ReactNode;
  size?: "md" | "lg";
  /** Render as the chat composer pill — round, hugs a Send button. */
  variant?: "default" | "pill";
  disabled?: boolean;
  name?: string;
  maxLength?: number;
  required?: boolean;
}

export function Input(props: InputProps): JSX.Element;
