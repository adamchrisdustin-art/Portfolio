import type { InsightChart } from "@/cms-intelligence/intelligence/evidence/schema";
import BarChart from "./BarChart";
import BoxPlot from "./BoxPlot";
import DonutChart from "./DonutChart";

/** Dispatches to the right chart component by InsightChart.type. */
export default function ChartRenderer({ chart }: { chart: InsightChart }) {
  if (chart.type === "bar") return <BarChart chart={chart} />;
  if (chart.type === "donut") return <DonutChart chart={chart} />;
  if (chart.type === "boxplot") return <BoxPlot chart={chart} />;
  return null;
}
