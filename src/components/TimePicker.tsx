"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

type Props = {
  value: string; // HH:mm
  onChange: (value: string) => void;
  label?: string;
  stepMinutes?: number; // default 5
};

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

export default function TimePicker({ value, onChange, label, stepMinutes = 5 }: Props) {
  const [h, m] = value.split(":");
  const hour = parseInt(h || "0");
  const minute = parseInt(m || "0");

  const minutes: string[] = [];
  for (let mm = 0; mm < 60; mm += stepMinutes) minutes.push(pad(mm));

  return (
    <div className="space-y-2">
      {label ? <label className="text-sm font-medium">{label}</label> : null}
      <div className="flex items-center gap-2">
        <Select
          value={pad(hour)}
          onValueChange={(hh) => onChange(`${hh}:${pad(minute)}`)}
        >
          <SelectTrigger className="w-[90px]"><SelectValue placeholder="HH" /></SelectTrigger>
          <SelectContent>
            {Array.from({ length: 24 }, (_, i) => pad(i)).map((hh) => (
              <SelectItem key={hh} value={hh}>{hh}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <span className="text-muted-foreground">:</span>

        <Select
          value={pad(minute)}
          onValueChange={(mm) => onChange(`${pad(hour)}:${mm}`)}
        >
          <SelectTrigger className="w-[90px]"><SelectValue placeholder="MM" /></SelectTrigger>
          <SelectContent>
            {minutes.map((mm) => (
              <SelectItem key={mm} value={mm}>{mm}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}


