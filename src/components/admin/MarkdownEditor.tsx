"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

const MDEditor = dynamic(() => import("@uiw/react-md-editor"), { ssr: false });

interface Props {
  name: string;
  defaultValue?: string;
  label?: string;
  required?: boolean;
}

export function MarkdownEditor({ name, defaultValue, label, required }: Props) {
  const [value, setValue] = useState(defaultValue ?? "");

  const labelClass = "text-sm text-muted-foreground mb-1 block";

  return (
    <div data-color-mode="dark">
      {label && (
        <span className={labelClass}>
          {label}
          {required && " *"}
        </span>
      )}
      <input type="hidden" name={name} value={value} required={required && !value} />
      <MDEditor
        value={value}
        onChange={(v) => setValue(v ?? "")}
        height={320}
        preview="edit"
        className="text-sm"
      />
    </div>
  );
}
