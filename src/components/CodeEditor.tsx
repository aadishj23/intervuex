"use client";

import { CODING_QUESTIONS, LANGUAGES, type CodeQuestion } from "@/constants";
import { useEffect, useMemo, useState } from "react";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "./ui/resizable";
import { ScrollArea, ScrollBar } from "./ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { AlertCircleIcon, BookIcon, Code2, LightbulbIcon, Palette } from "lucide-react";
import Editor from "@monaco-editor/react";
import { useCall } from "@stream-io/video-react-sdk";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Button } from "./ui/button";
import { CardDescription } from "./ui/card";
import { useUser } from "@clerk/nextjs";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import DrawingCanvas from "./canvas";
import { useUserRole } from "@/hooks/useUserRole";
import CreateProblemDialog from "./CreateProblemDialog";

function CodeEditor() {
  const call = useCall();
  const { user } = useUser();
  const { isInterviewer } = useUserRole();
  
  // Fetch custom problems
  const customProblems = useQuery(api.customProblems.getAllCustomProblems) || [];
  
  // Combine default and custom problems
  const allProblems = useMemo(() => {
    const customQs: CodeQuestion[] = customProblems.map((p) => ({
      id: `custom-${p._id}`,
      title: p.title,
      description: p.description,
      examples: p.examples,
      starterCode: {
        javascript: `// ${p.title}\nfunction solution() {\n  // Write your solution here\n  \n}`,
        python: `# ${p.title}\ndef solution():\n    # Write your solution here\n    pass`,
        java: `// ${p.title}\nclass Solution {\n    public void solution() {\n        // Write your solution here\n        \n    }\n}`,
      },
      constraints: p.constraints,
    }));
    return [...CODING_QUESTIONS, ...customQs];
  }, [customProblems]);
  
  const [selectedQuestion, setSelectedQuestion] = useState(allProblems[0]);
  type SupportedLang = "javascript" | "python" | "java" | "typescript" | "cpp" | "go";
  const [language, setLanguage] = useState<SupportedLang>(LANGUAGES[0].id as SupportedLang);
  const [activeTab, setActiveTab] = useState("description");
  
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
    if (!codeState || allProblems.length === 0) return;
    // Ignore echoes from our own updates
    if (codeState.updatedBy && user?.id && codeState.updatedBy === user.id) return;
    if (
      codeState.language &&
      ["javascript", "python", "java"].includes(codeState.language) &&
      codeState.language !== language
    ) {
      setLanguage(codeState.language as "javascript" | "python" | "java");
    }
    const initialQuestion = allProblems.find((q) => q.id === codeState.questionId);
    if (initialQuestion) setSelectedQuestion(initialQuestion);
    if (typeof codeState.code === "string" && codeState.code !== code) setCode(codeState.code);
  }, [codeState, user?.id, language, code, allProblems]);

  const handleQuestionChange = (questionId: string) => {
    const question = allProblems.find((q) => q.id === questionId)!;
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
  
  // Update selected question when allProblems changes
  useEffect(() => {
    if (allProblems.length > 0 && !allProblems.find((q) => q.id === selectedQuestion.id)) {
      setSelectedQuestion(allProblems[0]);
    }
  }, [allProblems, selectedQuestion.id]);

  const runCode = async () => {
    setIsRunning(true);
    setOutput("");
    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language, code }),
      });
      const data = await res.json();
      const out = data?.output;
      setOutput(out && out.trim().length > 0 ? out : "No output (print to stdout)");
    } catch (e: any) {
      setOutput(`Error: ${e?.message || e}`);
    } finally {
      setIsRunning(false);
    }
  };

  const handleLanguageChange = (newLanguage: SupportedLang) => {
    setLanguage(newLanguage);
    const nextTemplate = LANGUAGE_TEMPLATES[newLanguage];
    // Always switch to the new language's template
    setCode(nextTemplate);
    if (streamCallId) {
      void upsert({
        streamCallId,
        language: newLanguage,
        questionId: selectedQuestion.id,
        code: nextTemplate,
      });
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Tab Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <div className="border-b bg-background px-2 sm:px-4 flex-shrink-0">
          <TabsList className="h-11 sm:h-12 w-full justify-start rounded-none border-b-0 bg-transparent p-0">
            <TabsTrigger 
              value="description" 
              className="relative h-11 sm:h-12 rounded-none border-b-2 border-b-transparent bg-transparent px-2 sm:px-4 pb-2 sm:pb-3 pt-2 sm:pt-3 font-semibold text-xs sm:text-sm text-muted-foreground shadow-none transition-none data-[state=active]:border-b-primary data-[state=active]:text-foreground data-[state=active]:shadow-none"
            >
              <BookIcon className="w-4 h-4 mr-1 sm:mr-2 flex-shrink-0" />
              <span className="hidden sm:inline">Description</span>
              <span className="sm:hidden">Desc</span>
            </TabsTrigger>
            <TabsTrigger 
              value="code" 
              className="relative h-11 sm:h-12 rounded-none border-b-2 border-b-transparent bg-transparent px-2 sm:px-4 pb-2 sm:pb-3 pt-2 sm:pt-3 font-semibold text-xs sm:text-sm text-muted-foreground shadow-none transition-none data-[state=active]:border-b-primary data-[state=active]:text-foreground data-[state=active]:shadow-none"
            >
              <Code2 className="w-4 h-4 mr-1 sm:mr-2 flex-shrink-0" />
              <span className="hidden sm:inline">Code Editor</span>
              <span className="sm:hidden">Code</span>
            </TabsTrigger>
            <TabsTrigger 
              value="canvas" 
              className="relative h-11 sm:h-12 rounded-none border-b-2 border-b-transparent bg-transparent px-2 sm:px-4 pb-2 sm:pb-3 pt-2 sm:pt-3 font-semibold text-xs sm:text-sm text-muted-foreground shadow-none transition-none data-[state=active]:border-b-primary data-[state=active]:text-foreground data-[state=active]:shadow-none"
            >
              <Palette className="w-4 h-4 mr-1 sm:mr-2 flex-shrink-0" />
              <span>Canvas</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* DESCRIPTION TAB */}
        <TabsContent value="description" className="flex-1 min-h-0 flex flex-col m-0 border-0 p-0 data-[state=inactive]:hidden">
          <ScrollArea className="flex-1 w-full">
            <div className="p-3 sm:p-6">
              <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
                {/* HEADER */}
                <div className="flex flex-col gap-3 sm:gap-4">
                  <div className="space-y-1">
                    <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">
                      {selectedQuestion.title}
                    </h2>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      Read the problem description carefully
                    </p>
                  </div>
                  {isInterviewer && (
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <CreateProblemDialog />
                      <Select
                        value={selectedQuestion.id}
                        onValueChange={handleQuestionChange}
                      >
                        <SelectTrigger className="w-full sm:w-[200px] relative sm:static justify-center sm:justify-between [&>span]:text-center sm:[&>span]:text-left [&>svg]:absolute [&>svg]:right-3 sm:[&>svg]:relative sm:[&>svg]:right-0">
                          <SelectValue placeholder="Select question" />
                        </SelectTrigger>
                        <SelectContent>
                          {allProblems.map((q) => (
                            <SelectItem key={q.id} value={q.id}>
                              {q.id.startsWith("custom-") ? `★ ${q.title}` : q.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                {/* PROBLEM DESC. */}
                <Card>
                  <CardHeader className="flex flex-row items-center gap-2 p-4 sm:p-6">
                    <BookIcon className="h-4 w-4 sm:h-5 sm:w-5 text-primary/80 flex-shrink-0" />
                    <CardTitle className="text-base sm:text-lg">Problem Description</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm leading-relaxed p-4 sm:p-6 pt-0">
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <p className="whitespace-pre-line break-words">
                        {selectedQuestion.description}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* PROBLEM EXAMPLES */}
                <Card>
                  <CardHeader className="flex flex-row items-center gap-2 p-4 sm:p-6">
                    <LightbulbIcon className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-500 flex-shrink-0" />
                    <CardTitle className="text-base sm:text-lg">Examples</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 sm:p-6 pt-0">
                    <div className="space-y-3 sm:space-y-4">
                      {selectedQuestion.examples.map((example, index) => (
                        <div key={index} className="space-y-2">
                          <p className="font-medium text-xs sm:text-sm">
                            Example {index + 1}:
                          </p>
                          <pre className="bg-muted/50 p-2 sm:p-3 rounded-lg text-xs sm:text-sm font-mono overflow-x-auto">
                            <div className="break-words whitespace-pre-wrap">Input: {example.input}</div>
                            <div className="break-words whitespace-pre-wrap">Output: {example.output}</div>
                            {example.explanation && (
                              <div className="pt-2 text-muted-foreground break-words whitespace-pre-wrap">
                                Explanation: {example.explanation}
                              </div>
                            )}
                          </pre>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* CONSTRAINTS */}
                {selectedQuestion.constraints && (
                  <Card>
                    <CardHeader className="flex flex-row items-center gap-2 p-4 sm:p-6">
                      <AlertCircleIcon className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500 flex-shrink-0" />
                      <CardTitle className="text-base sm:text-lg">Constraints</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 sm:p-6 pt-0">
                      <ul className="list-disc list-inside space-y-1.5 text-xs sm:text-sm marker:text-muted-foreground">
                        {selectedQuestion.constraints.map((constraint, index) => (
                          <li key={index} className="text-muted-foreground break-words">
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
        </TabsContent>

        {/* CODE EDITOR TAB */}
        <TabsContent value="code" className="flex-1 m-0 border-0 p-0 data-[state=inactive]:hidden">
          <ResizablePanelGroup direction="vertical" className="flex-1">
            {/* CODE EDITOR */}
            <ResizablePanel defaultSize={70} minSize={30}>
              <div className="h-full flex flex-col">
                {/* Editor Toolbar */}
                <div className="flex items-center justify-between gap-3 px-4 py-3 border-b bg-muted/30">
                  <div className="flex items-center gap-3">
                    <Select value={language} onValueChange={handleLanguageChange}>
                      <SelectTrigger className="w-[150px]">
                        <SelectValue>
                          <div className="flex items-center gap-2">
                            <img
                              src={
                                LANGUAGES.find((l) => l.id === language)?.icon ||
                                `/${language}.png`
                              }
                              alt={language}
                              className="w-5 h-5 object-contain"
                            />
                            {LANGUAGES.find((l) => l.id === language)?.name}
                          </div>
                        </SelectValue>
                      </SelectTrigger>
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
                  </div>
                  <Button onClick={runCode} disabled={isRunning} size="sm">
                    {isRunning ? "Running..." : "Run Code"}
                  </Button>
                </div>

                {/* Monaco Editor */}
                <div className="flex-1">
                  <Editor
                    height="100%"
                    defaultLanguage={language}
                    language={language}
                    theme="vs-dark"
                    value={code}
                    onChange={async (value) => {
                      const newCode = value || "";
                      setCode(newCode);
                      if (streamCallId) {
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
                      fontSize: 14,
                      lineNumbers: "on",
                      scrollBeyondLastLine: false,
                      automaticLayout: true,
                      padding: { top: 16, bottom: 16 },
                      wordWrap: "on",
                      wrappingIndent: "indent",
                    }}
                  />
                </div>
              </div>
            </ResizablePanel>

            <ResizableHandle withHandle />

            {/* OUTPUT PANEL */}
            <ResizablePanel defaultSize={30} minSize={15} maxSize={60}>
              <div className="h-full flex flex-col">
                <div className="px-4 py-3 border-b bg-muted/30">
                  <h3 className="font-semibold text-sm">Output</h3>
                  <p className="text-xs text-muted-foreground">Program stdout/stderr</p>
                </div>
                <ScrollArea className="flex-1">
                  <pre className="p-4 text-sm whitespace-pre-wrap break-words font-mono">
                    {output || "Run your code to see output here..."}
                  </pre>
                  <ScrollBar />
                </ScrollArea>
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </TabsContent>

        {/* CANVAS TAB */}
        <TabsContent value="canvas" className="flex-1 m-0 border-0 p-0 data-[state=inactive]:hidden">
          <div className="h-full">
            <DrawingCanvas isEmbedded={true} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default CodeEditor;
