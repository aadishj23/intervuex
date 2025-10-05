import { CODING_QUESTIONS, LANGUAGES } from "@/constants";
import { useEffect, useMemo, useState } from "react";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "./ui/resizable";
import { ScrollArea, ScrollBar } from "./ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { AlertCircleIcon, BookIcon, LightbulbIcon } from "lucide-react";
import Editor from "@monaco-editor/react";
import { useCall } from "@stream-io/video-react-sdk";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Button } from "./ui/button";
import { CardDescription } from "./ui/card";
import { useUser } from "@clerk/nextjs";

function CodeEditor() {
  const call = useCall();
  const { user } = useUser();
  const [selectedQuestion, setSelectedQuestion] = useState(CODING_QUESTIONS[0]);
  type SupportedLang = "javascript" | "python" | "java" | "typescript" | "cpp" | "go";
  const [language, setLanguage] = useState<SupportedLang>(LANGUAGES[0].id as SupportedLang);
  // Shared boilerplate per language (kept same across all problems)
  const LANGUAGE_TEMPLATES: Record<SupportedLang, string> = {
    javascript: `// Write your solution here\nfunction solution(input) {\n  // TODO: implement\n  return input;\n}\n\n// You can test locally by calling solution()\nconsole.log(solution("hello"));\n`,
    typescript: `// Write your solution here\nexport function solution(input: unknown): unknown {\n  // TODO: implement\n  return input;\n}\n\nconsole.log(solution("hello"));\n`,
    python: `# Write your solution here\n\ndef solution(input):\n    # TODO: implement\n    return input\n\nprint(solution("hello"))\n`,
    java: `import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        System.out.println(solution("hello"));\n    }\n\n    static String solution(String input) {\n        // TODO: implement\n        return input;\n    }\n}\n`,
    cpp: `#include <bits/stdc++.h>\nusing namespace std;\n\nstring solution(const string &input){\n    // TODO: implement\n    return input;\n}\n\nint main(){\n    cout << solution("hello") << endl;\n    return 0;\n}\n`,
    go: `package main\n\nimport (\n    "fmt"\n)\n\nfunc solution(input any) any {\n    // TODO: implement\n    return input\n}\n\nfunc main(){\n    fmt.Println(solution("hello"))\n}\n`,
  };

  const [code, setCode] = useState<string>(LANGUAGE_TEMPLATES[language]);
  const [isRunning, setIsRunning] = useState(false);
  const [output, setOutput] = useState<string>("");

  const streamCallId = call?.id || "";
  const codeState = useQuery(api.code.getCodeStateByCallId, streamCallId ? { streamCallId } : "skip");
  const upsert = useMutation(api.code.upsertCodeState);

  // Initialize from shared state when joining
  useEffect(() => {
    if (!codeState) return;
    // Ignore echoes from our own updates
    if (codeState.updatedBy && user?.id && codeState.updatedBy === user.id) return;
    if (
      codeState.language &&
      ["javascript", "python", "java"].includes(codeState.language) &&
      codeState.language !== language
    ) {
      setLanguage(codeState.language as "javascript" | "python" | "java");
    }
    const initialQuestion = CODING_QUESTIONS.find((q) => q.id === codeState.questionId);
    if (initialQuestion) setSelectedQuestion(initialQuestion);
    if (typeof codeState.code === "string" && codeState.code !== code) setCode(codeState.code);
  }, [codeState, user?.id, language, code]);

  const handleQuestionChange = (questionId: string) => {
    const question = CODING_QUESTIONS.find((q) => q.id === questionId)!;
    setSelectedQuestion(question);
    if (streamCallId) {
      void upsert({
        streamCallId,
        language,
        questionId: question.id,
        code: code,
      });
    }
  };
  const runCode = async () => {
    setIsRunning(true);
    setOutput("");
    try {
      const langMap: Record<string, { language: string; version: string; wrapper?: (code: string) => string }> = {
        javascript: { language: "javascript", version: "18.15.0" },
        typescript: { language: "typescript", version: "5.0.3" },
        python: { language: "python", version: "3.10.0" },
        java: { language: "java", version: "15.0.2" },
        cpp: { language: "cpp", version: "10.2.0" },
        go: { language: "go", version: "1.20.2" },
      };
      const runtime = langMap[language];
      const res = await fetch("https://emkc.org/api/v2/piston/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language: runtime.language,
          version: runtime.version,
          files: [{ content: code }],
        }),
      });
      const data = await res.json();
      const out =
        data?.run?.output ||
        [data?.run?.stdout, data?.run?.stderr, data?.compile?.stderr, data?.message]
          .filter(Boolean)
          .join("\n");
      setOutput(out && out.trim().length > 0 ? out : "No output (print to stdout)");
    } catch (e: any) {
      setOutput(`Error: ${e?.message || e}`);
    } finally {
      setIsRunning(false);
    }
  };

  const handleLanguageChange = (newLanguage: SupportedLang) => {
    setLanguage(newLanguage);
    const currentTemplate = LANGUAGE_TEMPLATES[language];
    const nextTemplate = LANGUAGE_TEMPLATES[newLanguage];
    // If user is still on template (or empty), switch template; otherwise preserve their code
    if (code.trim() === "" || code.trim() === currentTemplate.trim()) {
      setCode(nextTemplate);
    }
    if (streamCallId) {
      void upsert({
        streamCallId,
        language: newLanguage,
        questionId: selectedQuestion.id,
        code: code.trim() === "" || code.trim() === currentTemplate.trim() ? nextTemplate : code,
      });
    }
  };

  return (
    <ResizablePanelGroup direction="vertical" className="min-h-[calc-100vh-4rem-1px]">
      {/* QUESTION SECTION */}
      <ResizablePanel>
        <ScrollArea className="h-full">
          <div className="p-6">
            <div className="max-w-4xl mx-auto space-y-6">
              {/* HEADER */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-semibold tracking-tight">
                      {selectedQuestion.title}
                    </h2>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Choose your language and solve the problem
                  </p>
                </div>
              <div className="flex items-center gap-3">
                  <Select value={selectedQuestion.id} onValueChange={handleQuestionChange}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Select question" />
                    </SelectTrigger>
                    <SelectContent>
                      {CODING_QUESTIONS.map((q) => (
                        <SelectItem key={q.id} value={q.id}>
                          {q.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={language} onValueChange={handleLanguageChange}>
                    <SelectTrigger className="w-[150px]">
                      {/* SELECT VALUE */}
                      <SelectValue>
                        <div className="flex items-center gap-2">
                          <img
                            src={LANGUAGES.find((l) => l.id === language)?.icon || `/${language}.png`}
                            alt={language}
                            className="w-5 h-5 object-contain"
                          />
                          {LANGUAGES.find((l) => l.id === language)?.name}
                        </div>
                      </SelectValue>
                    </SelectTrigger>
                    {/* SELECT CONTENT */}
                    <SelectContent>
                      {LANGUAGES.map((lang: any) => (
                        <SelectItem key={lang.id} value={lang.id}>
                          <div className="flex items-center gap-2">
                            <img
                              src={lang.icon || `/${lang.id}.png`}
                              alt={lang.name}
                              className="w-5 h-5 object-contain"
                            />
                            {lang.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button onClick={runCode} disabled={isRunning}>
                    {isRunning ? "Running..." : "Run code"}
                  </Button>
                </div>
              </div>

              {/* PROBLEM DESC. */}
              <Card>
                <CardHeader className="flex flex-row items-center gap-2">
                  <BookIcon className="h-5 w-5 text-primary/80" />
                  <CardTitle>Problem Description</CardTitle>
                </CardHeader>
                <CardContent className="text-sm leading-relaxed">
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <p className="whitespace-pre-line">{selectedQuestion.description}</p>
                  </div>
                </CardContent>
              </Card>

              {/* PROBLEM EXAMPLES */}
              <Card>
                <CardHeader className="flex flex-row items-center gap-2">
                  <LightbulbIcon className="h-5 w-5 text-yellow-500" />
                  <CardTitle>Examples</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-full w-full rounded-md border">
                    <div className="p-4 space-y-4">
                      {selectedQuestion.examples.map((example, index) => (
                        <div key={index} className="space-y-2">
                          <p className="font-medium text-sm">Example {index + 1}:</p>
                          <ScrollArea className="h-full w-full rounded-md">
                            <pre className="bg-muted/50 p-3 rounded-lg text-sm font-mono">
                              <div>Input: {example.input}</div>
                              <div>Output: {example.output}</div>
                              {example.explanation && (
                                <div className="pt-2 text-muted-foreground">
                                  Explanation: {example.explanation}
                                </div>
                              )}
                            </pre>
                            <ScrollBar orientation="horizontal" />
                          </ScrollArea>
                        </div>
                      ))}
                    </div>
                    <ScrollBar />
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* CONSTRAINTS */}
              {selectedQuestion.constraints && (
                <Card>
                  <CardHeader className="flex flex-row items-center gap-2">
                    <AlertCircleIcon className="h-5 w-5 text-blue-500" />
                    <CardTitle>Constraints</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="list-disc list-inside space-y-1.5 text-sm marker:text-muted-foreground">
                      {selectedQuestion.constraints.map((constraint, index) => (
                        <li key={index} className="text-muted-foreground">
                          {constraint}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
          <ScrollBar />
        </ScrollArea>
      </ResizablePanel>

      <ResizableHandle withHandle />

      {/* CODE EDITOR */}
      <ResizablePanel defaultSize={60} maxSize={100}>
        <div className="h-full relative">
          <Editor
            height={"100%"}
            defaultLanguage={language}
            language={language}
            theme="vs-dark"
            value={code}
          onChange={async (value) => {
            const newCode = value || "";
            setCode(newCode);
            if (streamCallId) {
              // debounce-like minimal: fire-and-forget
              void upsert({
                streamCallId,
                language,
                questionId: selectedQuestion.id,
                code: newCode,
              });
            }
          }}
            options={{
              minimap: { enabled: false },
              fontSize: 18,
              lineNumbers: "on",
              scrollBeyondLastLine: false,
              automaticLayout: true,
              padding: { top: 16, bottom: 16 },
              wordWrap: "on",
              wrappingIndent: "indent",
            }}
          />
        </div>
      </ResizablePanel>

      <ResizableHandle withHandle />

      {/* OUTPUT PANEL */}
      <ResizablePanel defaultSize={20} maxSize={60}>
        <div className="h-full p-4">
          <Card>
            <CardHeader className="py-3">
              <CardTitle>Output</CardTitle>
              <CardDescription>Program stdout/stderr</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-48 w-full rounded-md border">
                <pre className="p-3 text-sm whitespace-pre-wrap break-words">{output}</pre>
                <ScrollBar />
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
export default CodeEditor;
