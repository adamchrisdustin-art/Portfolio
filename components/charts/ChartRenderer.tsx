import type { InsightChart } from "@/cms-intelligence/intelligence/evidence/schema";
import BarChart from "./BarChart";
import BoxPlot from "./BoxPlot";
import DonutChart from "./DonutChart";
import ListChart from "./ListChart";
import ScatterChart from "./ScatterChart";

/** Dispatches to the right chart component by InsightChart.type. */
export default function ChartRenderer({ chart }: { chart: InsightChart }) {
  if (chart.type === "bar") return <BarChart chart={chart} />;
  if (chart.type === "donut") return <DonutChart chart={chart} />;
  if (chart.type === "boxplot") return <BoxPlot chart={chart} />;
  if (chart.type === "scatter") return <ScatterChart chart={chart} />;
  if (chart.type === "list") return <ListChart chart={chart} />;
  return null;
}
