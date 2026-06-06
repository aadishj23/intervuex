import { NextResponse } from "next/server";

// Wandbox compiler identifiers (verified against the live list). Pinned to
// current stable builds; update versions at https://wandbox.org/api/list.json
const COMPILERS: Record<string, { compiler: string; options?: string }> = {
  javascript: { compiler: "nodejs-20.17.0" },
  typescript: { compiler: "typescript-5.6.2" },
  python: { compiler: "cpython-3.13.8" },
  java: { compiler: "openjdk-jdk-22+36" },
  cpp: { compiler: "gcc-13.2.0", options: "-std=c++17" },
  go: { compiler: "go-1.23.2" },
};

const WANDBOX_URL =
  process.env.WANDBOX_URL ?? "https://wandbox.org/api/compile.json";

export async function POST(req: Request) {
  try {
    const { language, code, stdin } = await req.json();

    const runtime = COMPILERS[language];
    if (!runtime) {
      return NextResponse.json(
        { output: `Unsupported language: ${language}` },
        { status: 400 }
      );
    }

    // Wandbox compiles Java as prog.java, so a `public` top-level class fails
    // ("should be declared in a file named X.java"). Drop the public modifier.
    const source =
      language === "java"
        ? code.replace(/\bpublic\s+class\b/g, "class")
        : code;

    const res = await fetch(WANDBOX_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        compiler: runtime.compiler,
        code: source,
        stdin: stdin ?? "",
        ...(runtime.options
          ? { "compiler-option-raw": runtime.options }
          : {}),
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { output: `Wandbox error (${res.status}): ${text}` },
        { status: 502 }
      );
    }

    const data = await res.json();
    const output =
      [
        data.compiler_error,
        data.compiler_output,
        data.program_output,
        data.program_error,
        data.signal ? `Signal: ${data.signal}` : "",
      ]
        .filter(Boolean)
        .join("\n") || "No output (print to stdout)";

    return NextResponse.json({ output });
  } catch (e: any) {
    return NextResponse.json(
      { output: `Error: ${e?.message || e}` },
      { status: 500 }
    );
  }
}
