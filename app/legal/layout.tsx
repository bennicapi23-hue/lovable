import SiteHeader from "@/components/marketing/SiteHeader";
import SiteFooter from "@/components/marketing/SiteFooter";

/**
 * Shared shell for legal pages. The prose styles live here so each document
 * stays plain content: headings, paragraphs and lists, nothing else.
 */
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-kiln-obsidian text-kiln-studio-text antialiased">
      <SiteHeader />
      <main className="mx-auto max-w-[760px] px-24 pt-140 pb-96">
        <article
          className="
            [&_h1]:text-[38px] [&_h1]:leading-[1.1] [&_h1]:font-semibold
            [&_h1]:tracking-[-0.03em] [&_h1]:text-white [&_h1]:mb-8
            [&_h2]:text-[20px] [&_h2]:font-medium [&_h2]:text-white
            [&_h2]:mt-40 [&_h2]:mb-12
            [&_p]:text-[15px] [&_p]:leading-[1.7] [&_p]:text-white/60 [&_p]:mb-16
            [&_ul]:mb-16 [&_ul]:space-y-8 [&_ul]:pl-20 [&_ul]:list-disc
            [&_li]:text-[15px] [&_li]:leading-[1.65] [&_li]:text-white/60
            [&_li]:marker:text-white/25
            [&_a]:text-kiln-iris-300 [&_a]:underline [&_a]:underline-offset-2
            [&_strong]:text-white/85 [&_strong]:font-medium
            [&_code]:font-mono [&_code]:text-[13.5px] [&_code]:text-kiln-iris-200
          "
        >
          {children}
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}
