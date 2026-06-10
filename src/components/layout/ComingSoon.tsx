import { Card } from "@/components/ui/Card";

export function ComingSoon({
  title,
  phase,
  description,
}: {
  title: string;
  phase: string;
  description: string;
}) {
  return (
    <main className="px-6 py-10 max-w-3xl mx-auto w-full">
      <Card className="text-center py-16">
        <p className="text-xs uppercase tracking-widest text-[var(--pmfu-cobalt)] font-bold mb-2">
          {phase}
        </p>
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
          {title}
        </h1>
        <p className="text-gray-800 max-w-md mx-auto">{description}</p>
        <p className="mt-8 text-sm text-gray-700">Próximamente.</p>
      </Card>
    </main>
  );
}
