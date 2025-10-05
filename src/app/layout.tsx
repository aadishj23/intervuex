import type { Metadata } from "next";
import localFont from "next/font/local";
import "@stream-io/video-react-sdk/dist/css/styles.css";
import "./globals.css";
import { RedirectToSignIn, SignedIn, SignedOut } from "@clerk/nextjs";
import ConvexClerkProvider from "@/components/providers/ConvexClerkProvider";
import Navbar from "@/components/Navbar";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { Toaster } from "react-hot-toast";
import RoleChooser from "@/components/RoleChooser";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "IntervueX",
  description: "IntervueX is an all-in-one, role-aware technical interview platform. Schedule and host video interviews, collaborate live in a shared code editor with multi-language runtime and outputs, capture decisions and comments, and manage candidates and results in one streamlined, secure workflow.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ConvexClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <SignedIn>
              <div className="min-h-screen">
                <Navbar />
                <main className="px-4 sm:px-6 lg:px-8">
                  <RoleChooser />
                  {children}
                </main>
              </div>
            </SignedIn>

            <SignedOut>
              <RedirectToSignIn />
            </SignedOut>
          </ThemeProvider>
          <Toaster />
        </body>
      </html>
    </ConvexClerkProvider>
  );
}
