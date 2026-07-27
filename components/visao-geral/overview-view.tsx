"use client";

import { CashFlowCard } from "@/components/visao-geral/cash-flow-card";
import { FinancialLists } from "@/components/visao-geral/financial-lists";
import { MonthlyInsight } from "@/components/visao-geral/monthly-insight";
import { MonthlyPanel } from "@/components/visao-geral/monthly-panel";
import { OverviewHeading } from "@/components/visao-geral/overview-heading";
import { SummaryCards } from "@/components/visao-geral/summary-cards";
import { useFinancialOverviewData } from "@/lib/use-financial-overview";

export default function OverviewView() {
  const data = useFinancialOverviewData();

  return (
    <div className="overview-page">
      <OverviewHeading data={data} />
      <SummaryCards data={data} />

      <section className="overview-main-grid">
        <CashFlowCard data={data} />
        <MonthlyPanel data={data} />
      </section>

      <FinancialLists data={data} />
      <MonthlyInsight data={data} />
    </div>
  );
}
