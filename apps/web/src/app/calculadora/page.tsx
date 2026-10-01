import type { Metadata } from "next";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { PaceCalculator } from "@/components/tools/pace-calculator";

export const metadata: Metadata = { title: "Calculadora de ritmo y parciales" };

export default function CalculatorPage() {
  return (
    <>
      <SiteHeader />
      <main id="contenido" className="mx-auto max-w-4xl px-4 py-12">
        <h1 className="text-3xl font-bold tracking-tight text-navy">Calculadora de ritmo y parciales</h1>
        <p className="mt-2 text-muted">Calculá el ritmo necesario para un tiempo objetivo, o el tiempo final a un ritmo dado.</p>
        <div className="mt-8 rounded-2xl border border-line bg-white p-5 sm:p-8">
          <PaceCalculator />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
