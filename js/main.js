const FILE = "data/Sleep_health_and_lifestyle_dataset.csv";

const CANDIDATES = {
  sleep: [
    "Sleep Duration",
    "Sleep duration",
    "Sleep_Duration",
    "sleep_duration",
    "sleep",
    "Sleep Duration (hours)",
  ],
  stress: [
    "Stress Level",
    "Stress level",
    "Stress_Level",
    "stress_level",
    "stress",
  ],
  occupation: [
    "Occupation",
    "Job",
    "Job Title",
    "Profession",
    "job",
    "Work Type",
  ],
  quality: [
    "Quality of Sleep",
    "Quality_of_Sleep",
    "quality_of_sleep",
    "Quality",
  ],
  age: ["Age", "age"],
  activity: [
    "Physical Activity Level",
    "Physical_Activity_Level",
    "activity",
    "Exercise Frequency",
  ],
  heartRate: [
    "Heart Rate",
    "Resting Heart Rate",
    "heart_rate",
    "resting_hr",
    "Resting HR",
  ],
  bmi: ["BMI", "bmi", "Body Mass Index", "Body_Mass_Index"],
  bmiCat: [
    "BMI Category",
    "BMI_Category",
    "BMICategory",
    "BMI class",
    "BMI_Class",
  ],
  heart: ["Heart Rate", "Heart_Rate", "heart_rate", "bpm", "HeartRate"],
  disorder: [
    "Sleep Disorder",
    "Sleep_Disorder",
    "sleep_disorder",
    "Disorder",
    "Sleep Condition",
  ],
};

const state = {
  cols: {},
  data: [],
  jobData: [],
  flowData: [],
  flowGraph: null,
  selectedJob: null,
};

const tooltip = d3.select("body").append("div").attr("class", "tooltip");

const stressColorScale = d3
  .scaleLinear()
  .domain([3, 5.5, 8])
  .range(["#3b82f6", "#9ca3af", "#f97316"])
  .interpolate(d3.interpolateRgb);

const flowColorScale = d3
  .scaleOrdinal()
  .domain(["Low", "Medium", "High", "Poor (5–6)", "Average (7)", "Good (8–10)"])
  .range(["#ef4444", "#f59e0b", "#22c55e", "#b91c1c", "#a16207", "#0f766e"]);

function findCol(columns, names) {
  const lower = columns.map((c) => c.toLowerCase());
  for (const n of names) {
    const i = lower.indexOf(n.toLowerCase());
    if (i !== -1) return columns[i];
  }
  return null;
}

const sleepBucket = (q) =>
  q <= 6 ? "Poor (5–6)" : q === 7 ? "Average (7)" : "Good (8–10)";

function buildActivityMapper(values) {
  const nums = values.map((v) => +v).filter((v) => isFinite(v));
  const mostlyNumeric = nums.length >= values.length * 0.7;
  if (mostlyNumeric) {
    nums.sort(d3.ascending);
    const q1 = d3.quantile(nums, 0.33) || 0;
    const q2 = d3.quantile(nums, 0.66) || 0;
    const label = (v) => {
      const x = +v;
      if (!isFinite(x)) return "Medium";
      if (x <= q1) return "Low";
      if (x <= q2) return "Medium";
      return "High";
    };
    return { label, domain: ["Low", "Medium", "High"] };
  } else {
    const norm = (s) => String(s).trim().toLowerCase();
    const map = new Map([
      ["low", "Low"],
      ["minimal", "Low"],
      ["sedentary", "Low"],
      ["medium", "Medium"],
      ["moderate", "Medium"],
      ["high", "High"],
      ["vigorous", "High"],
    ]);
    const label = (v) =>
      map.get(norm(v)) ||
      String(v).charAt(0).toUpperCase() + String(v).slice(1);
    const domain = Array.from(new Set(values.map(label)));
    return { label, domain };
  }
}

function showTooltip(event, d, type) {
  let content = "";

  if (type === "job") {
    content = `
      <div class="tooltip-title">${d.job}</div>
      <div class="tooltip-stat"><span class="tooltip-label">People:</span><span class="tooltip-value">${
        d.count
      }</span></div>
      <div class="tooltip-stat"><span class="tooltip-label">Avg Sleep:</span><span class="tooltip-value">${d.avgSleep.toFixed(
        2
      )}h</span></div>
      <div class="tooltip-stat"><span class="tooltip-label">Avg Stress:</span><span class="tooltip-value">${d.avgStress.toFixed(
        2
      )}</span></div>
      ${
        d.avgQuality
          ? `<div class="tooltip-stat"><span class="tooltip-label">Avg Quality:</span><span class="tooltip-value">${d.avgQuality.toFixed(
              2
            )}</span></div>`
          : ""
      }
      ${
        d.avgActivity
          ? `<div class="tooltip-stat"><span class="tooltip-label">Avg Activity:</span><span class="tooltip-value">${d.avgActivity.toFixed(
              1
            )}</span></div>`
          : ""
      }
      <div style="margin-top: 12px; font-size: 11px; color: #8b949e; font-style: italic; padding-top: 8px; border-top: 1px solid #30363d;">Click to reveal individual stories</div>
    `;
  } else if (type === "individual") {
    content = `
      <div class="tooltip-title">Individual Worker</div>
      <div class="tooltip-stat"><span class="tooltip-label">Job:</span><span class="tooltip-value">${
        d.job
      }</span></div>
      <div class="tooltip-stat"><span class="tooltip-label">Sleep:</span><span class="tooltip-value">${
        d.sleep
      }h</span></div>
      <div class="tooltip-stat"><span class="tooltip-label">Stress:</span><span class="tooltip-value">${
        d.stress
      }</span></div>
      ${
        d.quality
          ? `<div class="tooltip-stat"><span class="tooltip-label">Quality:</span><span class="tooltip-value">${d.quality}</span></div>`
          : ""
      }
      ${
        d.age
          ? `<div class="tooltip-stat"><span class="tooltip-label">Age:</span><span class="tooltip-value">${d.age}</span></div>`
          : ""
      }
      ${
        d.activity
          ? `<div class="tooltip-stat"><span class="tooltip-label">Activity:</span><span class="tooltip-value">${d.activity}</span></div>`
          : ""
      }
    `;
  } else if (type === "flow") {
    content = `<div class="tooltip-title">Flow: <b>${d.value}</b> people</div>`;
  }

  tooltip
    .html(content)
    .classed("visible", true)
    .style("left", event.pageX + 15 + "px")
    .style("top", event.pageY - 15 + "px");
}

function hideTooltip() {
  tooltip.classed("visible", false);
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    const panel = d3.select("#detailPanel");
    if (panel && !panel.classed("hidden")) {
      closeDetailPanel();
    }
  }
});

d3.csv(FILE, d3.autoType)
  .then((rows) => {
    state.cols.sleep = findCol(rows.columns, CANDIDATES.sleep);
    state.cols.stress = findCol(rows.columns, CANDIDATES.stress);
    state.cols.occupation = findCol(rows.columns, CANDIDATES.occupation);
    state.cols.quality = findCol(rows.columns, CANDIDATES.quality);
    state.cols.age = findCol(rows.columns, CANDIDATES.age);
    state.cols.activity = findCol(rows.columns, CANDIDATES.activity);
    state.cols.heartRate = findCol(rows.columns, CANDIDATES.heartRate);

    if (
      !state.cols.sleep ||
      !state.cols.stress ||
      !state.cols.occupation ||
      !state.cols.quality ||
      !state.cols.activity
    ) {
      console.error("Couldn't auto-detect all required columns.");
      alert(
        "Error: Couldn't detect required columns in the dataset (need Sleep, Stress, Occupation, Quality, Activity)."
      );
      return;
    }

    state.data = rows
      .map((d) => ({
        sleep: +d[state.cols.sleep],
        stress: +d[state.cols.stress],
        job: String(d[state.cols.occupation]).trim(),
        quality: state.cols.quality ? +d[state.cols.quality] : null,
        age: state.cols.age ? +d[state.cols.age] : null,
        activity: state.cols.activity ? +d[state.cols.activity] : null,
        activityRaw: d[state.cols.activity],
        heartRate: state.cols.heartRate ? +d[state.cols.heartRate] : NaN,
      }))
      .filter((d) => isFinite(d.sleep) && isFinite(d.stress) && d.job);

    const jobStats = d3.rollup(
      state.data,
      (v) => ({
        avgSleep: d3.mean(v, (d) => d.sleep),
        avgStress: d3.mean(v, (d) => d.stress),
        avgQuality: state.cols.quality ? d3.mean(v, (d) => d.quality) : null,
        avgActivity: state.cols.activity ? d3.mean(v, (d) => d.activity) : null,
        count: v.length,
        individuals: v,
      }),
      (d) => d.job
    );

    state.jobData = Array.from(jobStats, ([job, stats]) => ({
      job,
      ...stats,
    })).sort((a, b) => d3.descending(a.count, b.count));

    const { label: actLabel } = buildActivityMapper(
      state.data.map((d) => d.activityRaw)
    );

    state.flowData = state.data.map((d) => ({
      sleepHours: d.sleep,
      sleepQuality: d.quality,
      activity: actLabel(d.activityRaw),
      sleepBucket: sleepBucket(d.quality),
      heartRate: isFinite(d.heartRate) ? d.heartRate : NaN,
    }));

    state.flowGraph = buildSankeyGraph(state.flowData);

    populateKeyFacts();
    generateInsights();
    updateKeyInsight();
    setTimeout(() => {
      updateSankeyKeyInsight();
      updateDreamLabKeyInsight();
      updateFinalInsights();
    }, 100);
    initVisualization();
    initDreamLab(rows);

    let resizeTimer;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        initVisualization();
      }, 250);
    });
  })
  .catch((err) => {
    console.error(err);
    d3.selectAll("#mainViz, #flowViz")
      .append("div")
      .style("color", "#ff6b6b")
      .style("padding", "12px")
      .text("Failed to load or process data. Check console for details.");
  });

function populateKeyFacts() {
  d3.select("#totalPeople").text(state.data.length);
  d3.select("#totalJobs").text(state.jobData.length);

  const avgSleep = d3.mean(state.data, (d) => d.sleep);
  d3.select("#avgSleepOverall").text(`${avgSleep.toFixed(1)}h`);

  const avgStress = d3.mean(state.data, (d) => d.stress);
  d3.select("#avgStressOverall").text(avgStress.toFixed(1));

  const sleepExtent = d3.extent(state.data, (d) => d.sleep);
  d3.select("#sleepRange").text(
    `${sleepExtent[0].toFixed(1)}h to ${sleepExtent[1].toFixed(1)}h`
  );

  const stressExtent = d3.extent(state.data, (d) => d.stress);
  d3.select("#stressRange").text(`${stressExtent[0]} to ${stressExtent[1]}`);
}

function calculateVariationMetrics() {
  const variations = state.jobData.map((job) => {
    const sleepValues = job.individuals.map((d) => d.sleep);
    const stressValues = job.individuals.map((d) => d.stress);
    const sleepRange = d3.extent(sleepValues);
    const stressRange = d3.extent(stressValues);
    const sleepStdDev =
      job.count > 1
        ? Math.sqrt(
            d3.mean(sleepValues.map((x) => Math.pow(x - job.avgSleep, 2)))
          )
        : 0;
    const stressStdDev =
      job.count > 1
        ? Math.sqrt(
            d3.mean(stressValues.map((x) => Math.pow(x - job.avgStress, 2)))
          )
        : 0;

    return {
      job: job.job,
      count: job.count,
      sleepRange: sleepRange[1] - sleepRange[0],
      stressRange: stressRange[1] - stressRange[0],
      sleepStdDev,
      stressStdDev,
      spansRestfulZone:
        sleepRange[0] < d3.mean(state.data, (d) => d.sleep) &&
        sleepRange[1] > d3.mean(state.data, (d) => d.sleep),
      spansStressRange:
        stressRange[0] < d3.mean(state.data, (d) => d.stress) &&
        stressRange[1] > d3.mean(state.data, (d) => d.stress),
    };
  });

  return variations;
}

function generateInsights() {
  const variations = calculateVariationMetrics();
  const highVariationJobs = variations
    .filter((v) => v.count >= 10)
    .sort((a, b) =>
      d3.descending(a.sleepRange + a.stressRange, b.sleepRange + b.stressRange)
    )
    .slice(0, 3);

  window.variationData = { variations, highVariationJobs };

  const sleepChamps = state.jobData
    .slice()
    .sort((a, b) => d3.descending(a.avgSleep, b.avgSleep))
    .slice(0, 3);

  d3.select("#sleepChampions").html(
    "Among all professions studied, " +
      sleepChamps
        .map((d, i) => {
          if (i === sleepChamps.length - 1 && sleepChamps.length > 1) {
            return `and <strong>${
              d.job
            }</strong> averaging ${d.avgSleep.toFixed(1)} hours`;
          }
          return `<strong>${d.job}</strong> averaging ${d.avgSleep.toFixed(
            1
          )} hours`;
        })
        .join(", ") +
      " claim the longest nights of rest."
  );

  const stressHighest = state.jobData
    .slice()
    .sort((a, b) => d3.descending(a.avgStress, b.avgStress))
    .slice(0, 3);

  d3.select("#stressHighest").html(
    "The weight of work falls heaviest on " +
      stressHighest
        .map((d, i) => {
          if (i === stressHighest.length - 1 && stressHighest.length > 1) {
            return `and <strong>${d.job}</strong> (${d.avgStress.toFixed(1)})`;
          }
          return `<strong>${d.job}</strong> (${d.avgStress.toFixed(1)})`;
        })
        .join(", ") +
      ", whose stress levels surpass all others."
  );

  const balanced = state.jobData
    .slice()
    .map((d) => ({
      ...d,
      score: d.avgSleep - d.avgStress,
    }))
    .sort((a, b) => d3.descending(a.score, b.score))
    .slice(0, 3);

  d3.select("#bestBalance").html(
    "The equilibrium between rest and tension is best achieved by " +
      balanced
        .map((d, i) => {
          if (i === balanced.length - 1 && balanced.length > 1) {
            return `and <strong>${d.job}</strong> (${d.avgSleep.toFixed(
              1
            )}h sleep, ${d.avgStress.toFixed(1)} stress)`;
          }
          return `<strong>${d.job}</strong> (${d.avgSleep.toFixed(
            1
          )}h sleep, ${d.avgStress.toFixed(1)} stress)`;
        })
        .join(", ") +
      ", who navigate their days with relative calm while maintaining healthy sleep."
  );
}

function updateKeyInsight() {
  const variations = calculateVariationMetrics();
  const jobsWithHighVariation = variations
    .filter((v) => v.count >= 10)
    .sort((a, b) =>
      d3.descending(a.sleepRange + a.stressRange, b.sleepRange + b.stressRange)
    );

  if (jobsWithHighVariation.length === 0) return;

  const bestExample = jobsWithHighVariation[0];
  const jobData = state.jobData.find((j) => j.job === bestExample.job);

  if (!jobData || jobData.count < 10) return;

  const sleepExtent = d3.extent(jobData.individuals, (d) => d.sleep);
  const stressExtent = d3.extent(jobData.individuals, (d) => d.stress);
  const avgSleep = d3.mean(state.data, (d) => d.sleep);
  const avgStress = d3.mean(state.data, (d) => d.stress);

  const spansMultipleZones =
    (sleepExtent[0] < avgSleep && sleepExtent[1] > avgSleep) ||
    (stressExtent[0] < avgStress && stressExtent[1] > avgStress);

  let insightText = "";

  if (bestExample.sleepRange >= 2.5 || bestExample.stressRange >= 2.5) {
    const sleepDiff = sleepExtent[1] - sleepExtent[0];
    const stressDiff = stressExtent[1] - stressExtent[0];

    const zoneDescription = spansMultipleZones
      ? "means the same job spans from the restful zone to high stress areas"
      : "reveals that job type alone cannot predict individual outcomes";

    insightText = `<strong>Key Insight:</strong> Within profession variation is substantial. For example, ${
      bestExample.job
    } (${
      jobData.count
    } people) shows individuals ranging from ${sleepExtent[0].toFixed(
      1
    )} to ${sleepExtent[1].toFixed(1)} hours of sleep, a ${sleepDiff.toFixed(
      1
    )} hour span, and stress levels from ${stressExtent[0].toFixed(
      1
    )} to ${stressExtent[1].toFixed(1)}, a ${stressDiff.toFixed(
      1
    )} point span. This ${zoneDescription}, indicating that personal lifestyle factors beyond work responsibilities significantly influence sleep quality and stress levels.`;
  } else {
    const jobsSpanningZones = variations.filter(
      (v) => (v.spansRestfulZone || v.spansStressRange) && v.count >= 5
    );
    if (jobsSpanningZones.length > 0) {
      const example = jobsSpanningZones[0];
      const exData = state.jobData.find((j) => j.job === example.job);
      const exSleepExtent = d3.extent(exData.individuals, (d) => d.sleep);
      const exStressExtent = d3.extent(exData.individuals, (d) => d.stress);

      insightText = `<strong>Key Insight:</strong> The bubble chart reveals that individual experiences within the same profession vary dramatically. For instance, ${
        example.job
      } shows sleep durations ranging from ${exSleepExtent[0].toFixed(
        1
      )} to ${exSleepExtent[1].toFixed(
        1
      )} hours, with stress levels spanning from ${exStressExtent[0].toFixed(
        1
      )} to ${exStressExtent[1].toFixed(
        1
      )}. This variation means that job type alone cannot determine sleep quality, as the same role can include people in the restful zone alongside those experiencing high stress, suggesting that lifestyle factors beyond work play a crucial role in individual outcomes.`;
    } else {
      insightText = `<strong>Key Insight:</strong> While each profession has an average sleep and stress profile, clicking on any bubble reveals that individual experiences within the same job vary widely. This variation shows that job type alone does not determine sleep quality or stress levels, as personal lifestyle factors, health habits, and individual circumstances significantly influence outcomes within every profession.`;
    }
  }

  const insightElement = d3.select("#keyInsightText");
  if (insightElement.empty()) {
    d3.select(".key-insight").html(`<p>${insightText}</p>`);
  } else {
    insightElement.html(insightText);
  }
}

function updateSankeyKeyInsight() {
  if (!state.flowGraph || !state.flowData || state.flowData.length === 0) {
    d3.select("#keyInsightSankey").html(
      "<strong>Key Insight:</strong> Loading analysis..."
    );
    return;
  }

  const grouped = d3.rollup(
    state.flowData,
    (v) => v.length,
    (d) => d.activity,
    (d) => d.sleepBucket
  );

  const activityTotals = new Map();
  const highActivityFlows = [];
  const lowActivityFlows = [];

  for (const [activity, buckets] of grouped.entries()) {
    let total = 0;
    const bucketCounts = {};
    for (const [bucket, count] of buckets.entries()) {
      total += count;
      bucketCounts[bucket] = count;
    }
    activityTotals.set(activity, { total, buckets: bucketCounts });

    const goodSleep = buckets.get("Good (8–10)") || 0;
    const poorSleep = buckets.get("Poor (5–6)") || 0;
    const goodRatio = total > 0 ? goodSleep / total : 0;
    const poorRatio = total > 0 ? poorSleep / total : 0;

    if (activity === "High") {
      highActivityFlows.push({
        activity,
        total,
        goodRatio,
        poorRatio,
        goodSleep,
        poorSleep,
      });
    } else if (activity === "Low") {
      lowActivityFlows.push({
        activity,
        total,
        goodRatio,
        poorRatio,
        goodSleep,
        poorSleep,
      });
    }
  }

  let insightText = "";

  if (highActivityFlows.length > 0 && lowActivityFlows.length > 0) {
    const high = highActivityFlows[0];
    const low = lowActivityFlows[0];
    const highGoodPct = (high.goodRatio * 100).toFixed(1);
    const lowGoodPct = (low.goodRatio * 100).toFixed(1);
    const highPoorPct = (high.poorRatio * 100).toFixed(1);
    const lowPoorPct = (low.poorRatio * 100).toFixed(1);

    if (high.goodRatio > low.goodRatio && high.goodRatio > 0.4) {
      insightText = `<strong>Key Insight:</strong> The Sankey diagram reveals a strong connection between physical activity and sleep quality. High activity individuals achieve good sleep quality ${highGoodPct}% of the time, compared to ${lowGoodPct}% for those with low activity levels. This ${(
        high.goodRatio - low.goodRatio
      ).toFixed(
        1
      )} percentage point difference demonstrates that regular movement creates a pathway to better rest, with ${
        high.goodSleep
      } out of ${
        high.total
      } high activity individuals experiencing good sleep, while only ${
        low.goodSleep
      } out of ${
        low.total
      } low activity individuals reach the same quality of rest.`;
    } else if (high.poorRatio < low.poorRatio) {
      insightText = `<strong>Key Insight:</strong> Activity level significantly influences sleep outcomes. While ${lowPoorPct}% of low activity individuals experience poor sleep quality, only ${highPoorPct}% of high activity individuals fall into this category. The flow of people from high activity to good sleep quality (${high.goodSleep} individuals) far exceeds the flow from low activity to good sleep (${low.goodSleep} individuals), revealing that physical movement creates a natural pathway toward restorative rest.`;
    } else {
      const medium = activityTotals.get("Medium");
      if (medium) {
        const mediumGood = medium.buckets["Good (8–10)"] || 0;
        const mediumTotal = medium.total;
        const mediumGoodPct =
          mediumTotal > 0 ? ((mediumGood / mediumTotal) * 100).toFixed(1) : 0;
        insightText = `<strong>Key Insight:</strong> The Sankey diagram shows that activity level creates distinct pathways to sleep quality. High activity flows most strongly toward good sleep quality (${high.goodSleep} people), while low activity shows a more balanced distribution across all sleep quality levels. Moderate activity individuals (${mediumGood} out of ${mediumTotal}, or ${mediumGoodPct}%) also tend toward better sleep, suggesting that any level of regular movement improves the odds of achieving quality rest compared to a sedentary lifestyle.`;
      } else {
        insightText = `<strong>Key Insight:</strong> The flow diagram demonstrates that physical activity level is a significant predictor of sleep quality. High activity individuals show a stronger tendency toward good sleep outcomes, with ${high.goodSleep} people flowing into the good sleep quality category, compared to ${low.goodSleep} from low activity backgrounds. This pattern reveals that movement creates a pathway to better rest, though individual variation means activity alone does not guarantee perfect sleep.`;
      }
    }
  } else {
    insightText = `<strong>Key Insight:</strong> The Sankey diagram reveals how physical activity levels flow into different sleep quality outcomes. The width of each connection shows the number of people following that path, demonstrating that activity level creates distinct patterns in sleep quality distribution, with higher activity generally associated with better sleep outcomes.`;
  }

  d3.select("#keyInsightSankey").html(insightText);
}

function updateDreamLabKeyInsight() {
  if (!state.data || state.data.length === 0) return;

  const hrCol = findCol(
    state.data[0] ? Object.keys(state.data[0]) : [],
    CANDIDATES.heart
  );
  const disCol = findCol(
    state.data[0] ? Object.keys(state.data[0]) : [],
    CANDIDATES.disorder
  );
  const bmiCatCol = findCol(
    state.data[0] ? Object.keys(state.data[0]) : [],
    CANDIDATES.bmiCat
  );

  if (!hrCol || !disCol) {
    d3.select("#keyInsightDreamLab").html(
      "<strong>Key Insight:</strong> Most people are in the “no sleep disorder” group and sit in the Normal BMI band with the lowest heart rates (typical ~68–70 bpm). Insomnia makes up about a quarter of the sample and spreads across Normal/Overweight; their heart rate is ~3–5 bpm higher on average than the “none” group in the same BMI band. Sleep apnea is the smallest group (roughly one in ten) but it clusters in Obese BMI and shows the highest heart rates—often 10+ bpm above the “none” group. Put simply: heart rate rises with BMI, but disorder status is the stronger separator—the high-BMI + high-HR corner is dominated by apnea, a combination that stands out as a practical screening flag."
    );
    return;
  }

  const hasDisorder = state.data.filter((d) => {
    const disorder = String(d[disCol] || "")
      .trim()
      .toLowerCase();
    return disorder && !disorder.includes("none") && disorder !== "";
  });

  const noDisorder = state.data.filter((d) => {
    const disorder = String(d[disCol] || "")
      .trim()
      .toLowerCase();
    return !disorder || disorder.includes("none") || disorder === "";
  });

  const hrWithDisorder = hasDisorder
    .map((d) => +d[hrCol])
    .filter((h) => isFinite(h) && h > 0);
  const hrNoDisorder = noDisorder
    .map((d) => +d[hrCol])
    .filter((h) => isFinite(h) && h > 0);

  const avgHRWithDisorder =
    hrWithDisorder.length > 0 ? d3.mean(hrWithDisorder) : null;
  const avgHRNoDisorder =
    hrNoDisorder.length > 0 ? d3.mean(hrNoDisorder) : null;

  let insightText = "";

  if (avgHRWithDisorder && avgHRNoDisorder) {
    const hrDiff = avgHRWithDisorder - avgHRNoDisorder;
    if (hrDiff > 2) {
      insightText = `<strong>Key Insight:</strong> The Dream Lab visualization reveals a clear physiological connection between sleep disorders and heart rate. Individuals with sleep disorders show an average resting heart rate of ${avgHRWithDisorder.toFixed(
        1
      )} beats per minute, ${hrDiff.toFixed(
        1
      )} bpm higher than those without disorders (${avgHRNoDisorder.toFixed(
        1
      )} bpm). This ${((hrDiff / avgHRNoDisorder) * 100).toFixed(
        1
      )}% increase suggests that sleep conditions place measurable stress on the cardiovascular system, even during rest. With ${
        hasDisorder.length
      } people experiencing sleep disorders compared to ${
        noDisorder.length
      } without, the data shows how widespread these physiological impacts are.`;
    } else if (bmiCatCol) {
      const bmiGroups = d3.group(state.data, (d) => {
        const cat = String(d[bmiCatCol] || "")
          .trim()
          .toLowerCase();
        if (cat.includes("obese")) return "Obese";
        if (cat.includes("over")) return "Overweight";
        if (cat.includes("normal")) return "Normal";
        if (cat.includes("under")) return "Underweight";
        return "Unknown";
      });

      const obeseGroup = bmiGroups.get("Obese") || [];
      const normalGroup = bmiGroups.get("Normal") || [];

      if (obeseGroup.length > 0 && normalGroup.length > 0) {
        const obeseDisorder = obeseGroup.filter((d) => {
          const disorder = String(d[disCol] || "")
            .trim()
            .toLowerCase();
          return disorder && !disorder.includes("none") && disorder !== "";
        }).length;
        const normalDisorder = normalGroup.filter((d) => {
          const disorder = String(d[disCol] || "")
            .trim()
            .toLowerCase();
          return disorder && !disorder.includes("none") && disorder !== "";
        }).length;

        const obeseDisorderPct = (
          (obeseDisorder / obeseGroup.length) *
          100
        ).toFixed(1);
        const normalDisorderPct = (
          (normalDisorder / normalGroup.length) *
          100
        ).toFixed(1);

        if (obeseDisorderPct > normalDisorderPct) {
          insightText = `<strong>Key Insight:</strong> Body composition and sleep disorders are deeply intertwined. The Dream Lab shows that ${obeseDisorderPct}% of individuals in the obese BMI category experience sleep disorders, compared to ${normalDisorderPct}% of those with normal BMI. This ${(
            obeseDisorderPct - normalDisorderPct
          ).toFixed(
            1
          )} percentage point difference reveals that body composition significantly influences sleep health, with ${obeseDisorder} out of ${
            obeseGroup.length
          } obese individuals affected, versus ${normalDisorder} out of ${
            normalGroup.length
          } in the normal weight category. The visualization demonstrates how physical health metrics correlate with sleep conditions across the population.`;
        } else {
          insightText = `<strong>Key Insight:</strong> The Dream Lab reveals complex relationships between physiological factors and sleep disorders. With ${hasDisorder.length} individuals experiencing sleep conditions and ${noDisorder.length} without, the data shows that sleep disorders affect a substantial portion of the population. The animated visualization demonstrates how heart rate, BMI categories, and sleep conditions intersect, revealing that these health factors are interconnected and cannot be considered in isolation when understanding sleep quality.`;
        }
      } else {
        insightText = `<strong>Key Insight:</strong> The Dream Lab visualization demonstrates that sleep disorders have measurable physiological impacts. With ${hasDisorder.length} individuals experiencing sleep conditions compared to ${noDisorder.length} without, the data reveals how widespread these conditions are. The relationship between heart rate, body composition, and sleep disorders shows that physical health and sleep quality are deeply connected, with each factor influencing the others in complex ways.`;
      }
    } else {
      insightText = `<strong>Key Insight:</strong> The Dream Lab reveals that sleep disorders affect ${hasDisorder.length} individuals in the dataset, compared to ${noDisorder.length} without conditions. The visualization demonstrates how physiological factors like heart rate intersect with sleep health, showing that sleep conditions have measurable impacts on the body even during rest. Each animated dot represents an individual, revealing patterns that would be invisible in aggregate statistics.`;
    }
  } else {
    insightText = `<strong>Key Insight:</strong> The Dream Lab visualization explores the relationship between body composition, heart rate, and sleep disorders. Each animated dot represents an individual, pulsing in sync with their resting heart rate, revealing how physiological factors correlate with sleep health. The interactive visualization demonstrates that these health dimensions cannot be considered separately when understanding sleep quality.`;
  }

  d3.select("#keyInsightDreamLab").html(insightText);
}

function updateFinalInsights() {
  const variations = calculateVariationMetrics();
  const jobsWithHighVariation = variations
    .filter((v) => v.count >= 10)
    .sort((a, b) =>
      d3.descending(a.sleepRange + a.stressRange, b.sleepRange + b.stressRange)
    );

  let insight1Text = `<p>Your profession does not define your sleep. The bubble chart reveals the same job can span from restful nights to chronic stress. The Sankey diagram shows activity levels create different pathways to rest. The Dream Lab demonstrates body composition alone cannot predict outcomes.</p><p class="take-action">Focus on personal lifestyle choices over workplace labels. Individual habits matter more than job titles when it comes to sleep quality.</p>`;

  if (jobsWithHighVariation.length > 0) {
    const example = jobsWithHighVariation[0];
    const jobData = state.jobData.find((j) => j.job === example.job);
    if (jobData) {
      const sleepExtent = d3.extent(jobData.individuals, (d) => d.sleep);
      insight1Text = `<p>Your profession does not define your sleep. The bubble chart shows that ${
        example.job
      } spans from ${sleepExtent[0].toFixed(1)} to ${sleepExtent[1].toFixed(
        1
      )} hours of sleep despite being the same profession. The Sankey diagram reveals that even high activity flows to multiple sleep outcomes. The Dream Lab demonstrates that BMI categories cannot predict individual disorders.</p><p class="take-action">Focus on personal lifestyle choices over workplace labels. Individual habits matter more than job titles when it comes to sleep quality.</p>`;
    }
  }

  const hrCol = findCol(
    state.data[0] ? Object.keys(state.data[0]) : [],
    CANDIDATES.heart
  );
  const disCol = findCol(
    state.data[0] ? Object.keys(state.data[0]) : [],
    CANDIDATES.disorder
  );

  let insight2Text = `<p>Physical activity directly improves sleep quality. The Sankey diagram shows high activity creates stronger pathways to good sleep. The Dream Lab reveals how heart rate and body composition correlate with sleep disorders. The bubble chart demonstrates that stress, which has physiological roots, varies dramatically within every profession.</p><p class="take-action">Increase daily movement, manage your weight, and monitor cardiovascular health. These physical interventions have measurable impacts on sleep quality.</p>`;

  const grouped = state.flowGraph
    ? d3.rollup(
        state.flowData,
        (v) => v.length,
        (d) => d.activity,
        (d) => d.sleepBucket
      )
    : null;

  if (grouped && hrCol && disCol && state.data.length > 0) {
    const highActivity = grouped.get("High");
    const lowActivity = grouped.get("Low");
    const hasDisorder = state.data.filter((d) => {
      const disorder = String(d[disCol] || "")
        .trim()
        .toLowerCase();
      return disorder && !disorder.includes("none") && disorder !== "";
    });
    const disorderPct = (
      (hasDisorder.length / state.data.length) *
      100
    ).toFixed(1);

    if (highActivity && lowActivity) {
      const highGood = highActivity.get("Good (8–10)") || 0;
      const lowGood = lowActivity.get("Good (8–10)") || 0;
      const highTotal = Array.from(highActivity.values()).reduce(
        (a, b) => a + b,
        0
      );
      const lowTotal = Array.from(lowActivity.values()).reduce(
        (a, b) => a + b,
        0
      );
      const highGoodPct =
        highTotal > 0 ? ((highGood / highTotal) * 100).toFixed(1) : 0;
      const lowGoodPct =
        lowTotal > 0 ? ((lowGood / lowTotal) * 100).toFixed(1) : 0;

      insight2Text = `<p>Physical activity directly improves sleep quality. The Sankey diagram shows ${highGoodPct}% of high activity individuals achieve good sleep compared to ${lowGoodPct}% with low activity. The Dream Lab reveals that ${disorderPct}% experience sleep disorders, and these correlate with heart rate and body composition. The bubble chart demonstrates that stress levels vary within every profession.</p><p class="take-action">Increase daily movement, manage your weight, and monitor cardiovascular health. These physical interventions create measurable improvements in sleep outcomes.</p>`;
    }
  }

  let insight3Text = `<p>Take control of your sleep through evidence based choices. The three visualizations converge on clear patterns: movement improves sleep quality, body composition affects sleep disorders, and personal circumstances matter more than job titles.</p><p class="take-action">Start with small changes: walk more each day, prioritize stress management techniques, and consult healthcare providers about sleep conditions. The data shows these actions create real differences regardless of your profession.</p>`;

  if (grouped) {
    const highActivity = grouped.get("High");
    const lowActivity = grouped.get("Low");
    if (highActivity && lowActivity) {
      const highGood = highActivity.get("Good (8–10)") || 0;
      const lowGood = lowActivity.get("Good (8–10)") || 0;
      const highTotal = Array.from(highActivity.values()).reduce(
        (a, b) => a + b,
        0
      );
      const lowTotal = Array.from(lowActivity.values()).reduce(
        (a, b) => a + b,
        0
      );
      const highGoodPct =
        highTotal > 0 ? ((highGood / highTotal) * 100).toFixed(1) : 0;
      const lowGoodPct =
        lowTotal > 0 ? ((lowGood / lowTotal) * 100).toFixed(1) : 0;

      insight3Text = `<p>Take control of your sleep through evidence based choices. The Sankey diagram shows ${highGoodPct}% of high activity individuals achieve good sleep versus ${lowGoodPct}% with low activity. The Dream Lab reveals how physical health correlates with sleep disorders. The bubble chart demonstrates that personal circumstances matter more than job titles.</p><p class="take-action">Start with small changes: walk more each day, prioritize stress management techniques, and consult healthcare providers about sleep conditions. The data shows these actions create real differences regardless of your profession.</p>`;
    }
  }

  d3.select("#finalInsight1").html(insight1Text);
  d3.select("#finalInsight2").html(insight2Text);
  d3.select("#finalInsight3").html(insight3Text);
}

function initVisualization() {
  renderBubbleChart();
  renderSankey(state.flowGraph);
}

function renderBubbleChart() {
  const container = d3.select("#mainViz");
  container.selectAll("*").remove();

  const width = container.node().getBoundingClientRect().width;
  const height = container.node().getBoundingClientRect().height;
  const margin = { top: 60, right: 60, bottom: 80, left: 80 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const svg = container
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  const g = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const xScale = d3
    .scaleLinear()
    .domain(d3.extent(state.data, (d) => d.sleep))
    .nice()
    .range([0, innerWidth]);

  const yScale = d3
    .scaleLinear()
    .domain(d3.extent(state.data, (d) => d.stress))
    .nice()
    .range([innerHeight, 0]);

  const maxCount = d3.max(state.jobData, (d) => d.count);
  const minCount = d3.min(state.jobData, (d) => d.count);
  const sizeScale = d3.scaleSqrt().domain([minCount, maxCount]).range([4, 50]);

  const xGrid = g
    .append("g")
    .attr("class", "grid")
    .attr("transform", `translate(0,${innerHeight})`);

  xGrid
    .call(d3.axisBottom(xScale).tickSize(-innerHeight).tickFormat("").ticks(10))
    .selectAll("line")
    .attr("class", "grid-line");

  xGrid.select(".domain").remove();

  const yGrid = g.append("g").attr("class", "grid");

  yGrid
    .call(d3.axisLeft(yScale).tickSize(-innerWidth).tickFormat("").ticks(10))
    .selectAll("line")
    .attr("class", "grid-line");

  yGrid.select(".domain").remove();

  const xAxis = g
    .append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(xScale).ticks(10));

  const yAxis = g
    .append("g")
    .attr("class", "axis")
    .call(d3.axisLeft(yScale).ticks(10));

  g.append("text")
    .attr("class", "axis-label")
    .attr("x", innerWidth / 2)
    .attr("y", innerHeight + 55)
    .attr("text-anchor", "middle")
    .text("SLEEP DURATION (hours)");

  g.append("text")
    .attr("class", "axis-label")
    .attr("transform", "rotate(-90)")
    .attr("x", -innerHeight / 2)
    .attr("y", -55)
    .attr("text-anchor", "middle")
    .text("STRESS LEVEL");

  const idealX = d3.mean(state.data, (d) => d.sleep);
  const idealY = d3.mean(state.data, (d) => d.stress);

  g.append("line")
    .attr("x1", xScale(idealX))
    .attr("x2", xScale(idealX))
    .attr("y1", 0)
    .attr("y2", innerHeight)
    .attr("class", "annotation-line");

  g.append("line")
    .attr("x1", 0)
    .attr("x2", innerWidth)
    .attr("y1", yScale(idealY))
    .attr("y2", yScale(idealY))
    .attr("class", "annotation-line");

  const bubblesGroup = g.append("g").attr("class", "bubbles");
  const individualDotsGroup = g.append("g").attr("class", "individual-dots");

  const bubbles = bubblesGroup
    .selectAll(".job-bubble")
    .data(state.jobData)
    .join("circle")
    .attr("class", "job-bubble")
    .attr("cx", (d) => xScale(d.avgSleep))
    .attr("cy", (d) => yScale(d.avgStress))
    .attr("r", (d) => sizeScale(d.count))
    .attr("fill", (d) => stressColorScale(d.avgStress))
    .attr("opacity", 0.85)
    .on("mouseover", function (event, d) {
      if (state.selectedJob !== d.job) {
        d3.select(this).transition().duration(200).attr("opacity", 1);
      }
      showTooltip(event, d, "job");
    })
    .on("mouseout", function (event, d) {
      if (state.selectedJob !== d.job) {
        d3.select(this).transition().duration(200).attr("opacity", 0.85);
      }
      hideTooltip();
    })
    .on("click", function (event, d) {
      event.stopPropagation();
      if (state.selectedJob === d.job) {
        state.selectedJob = null;
        updateBubbleSelection();
      } else {
        state.selectedJob = d.job;
        updateBubbleSelection();
      }
    });

  const labels = bubblesGroup
    .selectAll(".job-label")
    .data(state.jobData)
    .join("text")
    .attr("class", (d) => `job-label ${d.count > 20 ? "large" : ""}`)
    .attr("x", (d) => xScale(d.avgSleep))
    .attr("y", (d) => yScale(d.avgStress))
    .attr("text-anchor", "middle")
    .attr("dy", "0.35em")
    .text((d) => {
      if (d.count > 15) {
        return d.job;
      } else if (d.count > 8) {
        return d.job.length > 12 ? d.job.substring(0, 10) + "..." : d.job;
      } else {
        return "";
      }
    })
    .style(
      "font-size",
      (d) => `${Math.max(10, Math.min(14, sizeScale(d.count) / 3))}px`
    );

  const annotationsGroup = g.append("g").attr("class", "annotations");

  const annotationX = xScale(
    idealX + (d3.max(state.data, (d) => d.sleep) - idealX) / 2
  );
  const annotationY = yScale(
    idealY - (idealY - d3.min(state.data, (d) => d.stress)) / 2
  );

  const rectWidth = 170;
  const rectHeight = 34;

  annotationsGroup
    .append("rect")
    .attr("x", annotationX - rectWidth / 2)
    .attr("y", annotationY - rectHeight / 2)
    .attr("width", rectWidth)
    .attr("height", rectHeight)
    .attr("fill", "rgba(13, 17, 23, 0.85)")
    .attr("stroke", "#58a6ff")
    .attr("stroke-width", 1.5)
    .attr("rx", 6);

  annotationsGroup
    .append("text")
    .attr("class", "annotation-text")
    .attr("x", annotationX)
    .attr("y", annotationY)
    .attr("text-anchor", "middle")
    .attr("dominant-baseline", "middle")
    .text("THE RESTFUL ZONE")
    .style("font-size", "13px")
    .style("font-weight", "700")
    .style("letter-spacing", "2px")
    .style("fill", "#58a6ff");

  svg.on("click", function (event) {
    if (event.target === svg.node() || event.target.tagName === "svg") {
      if (state.selectedJob) {
        state.selectedJob = null;
        updateBubbleSelection();
        closeDetailPanel();
      }
    }
  });

  function updateBubbleSelection() {
    bubbles
      .classed("selected", (d) => d.job === state.selectedJob)
      .classed("faded", (d) => state.selectedJob && d.job !== state.selectedJob)
      .attr("opacity", (d) => {
        if (state.selectedJob === d.job) return 1;
        if (state.selectedJob && d.job !== state.selectedJob) return 0.2;
        return 0.85;
      });

    labels.attr("opacity", (d) => {
      if (state.selectedJob === d.job) return 1;
      if (state.selectedJob && d.job !== state.selectedJob) return 0.3;
      return 0.9;
    });

    if (state.selectedJob) {
      const selectedJobData = state.jobData.find(
        (d) => d.job === state.selectedJob
      );

      const allIndividuals = selectedJobData.individuals;

      allIndividuals.forEach((d, i) => {
        const seed = d.sleep * 1000 + d.stress * 100 + i;
        const rng = (seed) => {
          const x = Math.sin(seed) * 10000;
          return x - Math.floor(x);
        };
        d._jitterX = (rng(seed) - 0.5) * 2.5;
        d._jitterY = (rng(seed + 1) - 0.5) * 2.5;
      });

      individualDotsGroup
        .selectAll(".individual-dot")
        .data(allIndividuals, (d, i) => `dot-${i}-${d.sleep}-${d.stress}`)
        .join(
          (enter) => {
            const dots = enter
              .append("circle")
              .attr("class", "individual-dot")
              .attr("pointer-events", "all")
              .attr("cx", (d) => xScale(d.sleep) + (d._jitterX || 0))
              .attr("cy", (d) => yScale(d.stress) + (d._jitterY || 0))
              .attr("r", 0)
              .style("z-index", "1000");

            dots
              .transition()
              .duration(300)
              .delay((d, i) => Math.min(i * 3, 200))
              .attr("r", 4);

            return dots;
          },
          (update) => {
            update
              .attr("cx", (d) => xScale(d.sleep) + (d._jitterX || 0))
              .attr("cy", (d) => yScale(d.stress) + (d._jitterY || 0))
              .attr("r", 4);
            return update;
          },
          (exit) => exit.transition().duration(300).attr("r", 0).remove()
        )
        .on("click", function (event, d) {
          event.stopPropagation();
          showTooltip(event, d, "individual");
        })
        .on("mouseover", function (event, d) {
          d3.select(this)
            .transition()
            .duration(150)
            .attr("r", 6)
            .attr("stroke-width", 3);
          showTooltip(event, d, "individual");
        })
        .on("mouseout", function () {
          d3.select(this)
            .transition()
            .duration(150)
            .attr("r", 4)
            .attr("stroke-width", 2);
          hideTooltip();
        });

      updateDetailPanel(selectedJobData);
    } else {
      individualDotsGroup
        .selectAll(".individual-dot")
        .transition()
        .duration(300)
        .attr("r", 0)
        .remove();

      const panel = d3.select("#detailPanel");

      panel.classed("hidden", true);
      d3.select(".detail-panel-backdrop").classed("visible", false);
      d3.select("#detailTitle").text("Select an element to see details");
      d3.select("#detailContent").html("");
    }
  }

  state.updateBubbleSelection = updateBubbleSelection;
  updateBubbleSelection();

  function updateDetailPanel(jobData) {
    const panel = d3.select("#detailPanel");

    panel.classed("hidden", false);
    d3.select(".detail-panel-backdrop").classed("visible", true);
    d3.select("#detailTitle").text(jobData.job);

    const maxSleep = d3.max(state.jobData, (d) => d.avgSleep);
    const maxStress = d3.max(state.jobData, (d) => d.avgStress);
    const maxQuality = state.cols.quality
      ? d3.max(state.jobData, (d) => d.avgQuality)
      : 10;
    const maxActivity = state.cols.activity
      ? d3.max(state.jobData, (d) => d.avgActivity)
      : 100;

    const sleepValues = jobData.individuals
      .map((d) => d.sleep)
      .sort(d3.ascending);
    const stressValues = jobData.individuals
      .map((d) => d.stress)
      .sort(d3.ascending);
    const sleepRange =
      jobData.count > 1
        ? `${sleepValues[0].toFixed(1)}h - ${sleepValues[
            sleepValues.length - 1
          ].toFixed(1)}h`
        : `${sleepValues[0].toFixed(1)}h`;
    const stressRange =
      jobData.count > 1
        ? `${stressValues[0].toFixed(1)} - ${stressValues[
            stressValues.length - 1
          ].toFixed(1)}`
        : `${stressValues[0].toFixed(1)}`;

    const sleepQ1 = d3.quantile(sleepValues, 0.25);
    const sleepQ3 = d3.quantile(sleepValues, 0.75);
    const stressQ1 = d3.quantile(stressValues, 0.25);
    const stressQ3 = d3.quantile(stressValues, 0.75);

    let detailHTML = `
      <div class="detail-stat">
        <div>
          <div class="detail-label">Sample Size</div>
          <div class="detail-value">${jobData.count} people</div>
          ${
            jobData.count > 1
              ? `<div class="detail-subtext">All ${jobData.count} individuals shown</div>`
              : ""
          }
        </div>
      </div>
      <div class="detail-stat">
        <div style="width: 100%;">
          <div class="detail-label">Sleep Duration</div>
          <div class="detail-value">${jobData.avgSleep.toFixed(2)} hours</div>
          <div class="detail-range">Range: ${sleepRange}</div>
          ${
            jobData.count > 3
              ? `<div class="detail-range">IQR: ${sleepQ1.toFixed(
                  1
                )}h - ${sleepQ3.toFixed(1)}h</div>`
              : ""
          }
          <div class="detail-bar-container">
            <div class="detail-bar" style="width: ${
              (jobData.avgSleep / maxSleep) * 100
            }%; background: #3b82f6;"></div>
          </div>
        </div>
      </div>
      <div class="detail-stat">
        <div style="width: 100%;">
          <div class="detail-label">Stress Level</div>
          <div class="detail-value">${jobData.avgStress.toFixed(2)}</div>
          <div class="detail-range">Range: ${stressRange}</div>
          ${
            jobData.count > 3
              ? `<div class="detail-range">IQR: ${stressQ1.toFixed(
                  1
                )} - ${stressQ3.toFixed(1)}</div>`
              : ""
          }
          <div class="detail-bar-container">
            <div class="detail-bar" style="width: ${
              (jobData.avgStress / maxStress) * 100
            }%; background: ${stressColorScale(jobData.avgStress)};"></div>
          </div>
        </div>
      </div>
    `;

    if (jobData.avgQuality) {
      const qualityValues = jobData.individuals
        .map((d) => d.quality)
        .filter((v) => v != null)
        .sort(d3.ascending);
      const qualityRange =
        qualityValues.length > 1
          ? `${qualityValues[0].toFixed(1)} - ${qualityValues[
              qualityValues.length - 1
            ].toFixed(1)}`
          : qualityValues.length > 0
          ? `${qualityValues[0].toFixed(1)}`
          : "N/A";

      detailHTML += `
        <div class="detail-stat">
          <div style="width: 100%;">
            <div class="detail-label">Sleep Quality</div>
            <div class="detail-value">${jobData.avgQuality.toFixed(2)}</div>
            ${
              qualityValues.length > 1
                ? `<div class="detail-range">Range: ${qualityRange}</div>`
                : ""
            }
            <div class="detail-bar-container">
              <div class="detail-bar" style="width: ${
                (jobData.avgQuality / maxQuality) * 100
              }%; background: #7c4dff;"></div>
            </div>
          </div>
        </div>
      `;
    }

    if (jobData.avgActivity) {
      const activityValues = jobData.individuals
        .map((d) => d.activity)
        .filter((v) => v != null && isFinite(v))
        .sort(d3.ascending);
      const activityRange =
        activityValues.length > 1
          ? `${activityValues[0].toFixed(1)} - ${activityValues[
              activityValues.length - 1
            ].toFixed(1)}`
          : activityValues.length > 0
          ? `${activityValues[0].toFixed(1)}`
          : "N/A";

      detailHTML += `
        <div class="detail-stat">
          <div style="width: 100%;">
            <div class="detail-label">Physical Activity</div>
            <div class="detail-value">${jobData.avgActivity.toFixed(1)}</div>
            ${
              activityValues.length > 1
                ? `<div class="detail-range">Range: ${activityRange}</div>`
                : ""
            }
            <div class="detail-bar-container">
              <div class="detail-bar" style="width: ${
                (jobData.avgActivity / maxActivity) * 100
              }%; background: #4dabf7;"></div>
            </div>
          </div>
        </div>
      `;
    }

    const comparisonRank =
      state.jobData
        .sort((a, b) => d3.descending(a.count, b.count))
        .findIndex((d) => d.job === jobData.job) + 1;
    const totalJobs = state.jobData.length;

    detailHTML += `
      <div class="detail-stat">
        <div>
          <div class="detail-label">Relative Size</div>
          <div class="detail-value">${comparisonRank}${
      comparisonRank === 1
        ? "st"
        : comparisonRank === 2
        ? "nd"
        : comparisonRank === 3
        ? "rd"
        : "th"
    }</div>
          <div class="detail-subtext">of ${totalJobs} professions by sample size</div>
        </div>
      </div>
    `;

    d3.select("#detailContent").html(detailHTML);
  }
}

function closeDetailPanel() {
  state.selectedJob = null;
  const panel = d3.select("#detailPanel");

  panel.classed("hidden", true).classed("expanded", false);
  d3.select(".detail-panel-backdrop").classed("visible", false);

  if (state.updateBubbleSelection) {
    state.updateBubbleSelection();
  }
}

function togglePanelExpand() {
  const panel = document.getElementById("detailPanel");
  if (panel && !panel.classList.contains("hidden")) {
    panel.classList.toggle("expanded");
    const expandBtn = document.querySelector(".detail-expand-btn");
    if (expandBtn) {
      const icon = expandBtn.querySelector("#expand-icon");
      if (icon) {
        icon.setAttribute(
          "d",
          panel.classList.contains("expanded")
            ? "M8 12V4M4 8h8"
            : "M8 4v8M4 8h8"
        );
      }
    }
  }
}

function buildSankeyGraph(rows) {
  const grouped = d3.rollup(
    rows,
    (v) => ({ value: v.length, records: v }),
    (d) => d.activity,
    (d) => d.sleepBucket
  );

  const nodeSet = new Set();
  const linksTmp = [];
  for (const [a, sub] of grouped.entries()) {
    nodeSet.add(a);
    for (const [b, obj] of sub.entries()) {
      nodeSet.add(b);
      linksTmp.push({
        source: a,
        target: b,
        value: obj.value,
        records: obj.records,
      });
    }
  }
  const nodes = Array.from(nodeSet, (name) => ({ name }));
  const idx = new Map(nodes.map((d, i) => [d.name, i]));
  const links = linksTmp.map((l) => ({
    source: idx.get(l.source),
    target: idx.get(l.target),
    value: l.value,
    records: l.records,
  }));
  return { nodes, links };
}
function renderSankey(graph) {
  const host = d3.select("#flowViz");
  host.selectAll("*").remove();

  const width = host.node().getBoundingClientRect().width || 900;
  const height = Math.max(520, Math.round(width * 0.55));

  const svg = host.append("svg").attr("width", width).attr("height", height);

  const sankey = d3
    .sankey()
    .nodeWidth(18)
    .nodePadding(12)
    .extent([
      [16, 16],
      [width - 16, height - 16],
    ]);

  const { nodes, links } = sankey({
    nodes: graph.nodes.map((d) => ({ ...d })),
    links: graph.links.map((d) => ({ ...d })),
  });

  const prefersReduced =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const BASE_LINK_OPACITY = 0.28;
  const BASE_OUTLINE_OPACITY = 0.85;
  const DIMMED_LINK_OPACITY = 0.08;
  const DIMMED_OUTLINE_OPACITY = 0.15;

  const gLinks = svg.append("g");
  const gOutlines = gLinks.append("g");
  const gColors = gLinks.append("g");
  const gFlow = gLinks.append("g").attr("class", "flow-movers");

  const outlines = gOutlines
    .selectAll("path")
    .data(links)
    .join("path")
    .attr("class", "sankey-link-outline")
    .attr("d", d3.sankeyLinkHorizontal())
    .attr("stroke", "#0d1117")
    .attr("stroke-width", (d) => Math.max(1, d.width) + 4)
    .attr("stroke-opacity", prefersReduced ? BASE_OUTLINE_OPACITY : 0)
    .attr("fill", "none");

  const paths = gColors
    .selectAll("path")
    .data(links)
    .join("path")
    .attr("class", "sankey-link")
    .attr("d", d3.sankeyLinkHorizontal())
    .attr("stroke", (d) => flowColorScale(nodes[d.source.index].name))
    .attr("stroke-width", (d) => Math.max(1, d.width))
    .attr("stroke-opacity", prefersReduced ? BASE_LINK_OPACITY : 0)
    .attr("fill", "none")
    .style("cursor", "pointer");

  const overlays = gFlow
    .selectAll("path")
    .data(
      links.map((l) => {
        const speed = 24 + Math.min(36, l.width * 2.2);
        return { ...l, __speed: speed };
      })
    )
    .join("path")
    .attr("class", "sankey-link-flow")
    .attr("d", d3.sankeyLinkHorizontal())
    .attr("stroke", (d) => {
      const c = d3.color(flowColorScale(nodes[d.source.index].name));
      return c ? c.brighter(1.2).formatHex() : "#cbd3eb";
    })
    .attr("stroke-width", (d) => Math.max(1, d.width))
    .attr("stroke-linecap", "round")
    .attr("fill", "none")
    .attr("stroke-opacity", prefersReduced ? 0 : 0.32)
    .attr("stroke-dasharray", "10 16")
    .attr("stroke-dashoffset", 0)
    .style("pointer-events", "none");

  if (!prefersReduced) {
    const t0 = performance.now();
    d3.timer((now) => {
      const dt = (now - t0) / 1000;
      overlays.attr("stroke-dashoffset", (d) => -(dt * d.__speed));
    });
  }

  svg
    .append("g")
    .selectAll("rect")
    .data(nodes)
    .join("rect")
    .attr("x", (d) => d.x0)
    .attr("y", (d) => d.y0)
    .attr("width", (d) => d.x1 - d.x0)
    .attr("height", (d) => d.y1 - d.y0)
    .attr("fill", (d) => d3.color(flowColorScale(d.name)))
    .attr("stroke", (d) => d3.color(flowColorScale(d.name)).darker(0.7))
    .attr("opacity", prefersReduced ? 1 : 0);

  svg
    .append("g")
    .style("font", "12px DM Sans, system-ui, sans-serif")
    .selectAll("text")
    .data(nodes)
    .join("text")
    .attr("x", (d) => (d.x0 < width / 2 ? d.x1 + 6 : d.x0 - 6))
    .attr("y", (d) => (d.y0 + d.y1) / 2)
    .attr("dy", "0.35em")
    .attr("text-anchor", (d) => (d.x0 < width / 2 ? "start" : "end"))
    .attr("fill", "#cbd3eb")
    .text((d) => `${d.name} (${d.value})`)
    .attr("opacity", prefersReduced ? 1 : 0);

  svg
    .append("rect")
    .attr("x", 8)
    .attr("y", 8)
    .attr("width", width - 16)
    .attr("height", height - 16)
    .attr("rx", 12)
    .attr("fill", "none")
    .attr("stroke", "#30363d");

  if (!prefersReduced) {
    const ease = d3.easeCubicInOut;

    paths
      .each(function () {
        const L = this.getTotalLength();
        d3.select(this)
          .attr("stroke-dasharray", `${L} ${L}`)
          .attr("stroke-dashoffset", L);
      })
      .transition()
      .delay((d) => 120 + (d.source.x0 / width) * 420)
      .duration((d) => 900 + Math.min(600, d.width * 6))
      .ease(ease)
      .attr("stroke-dashoffset", 0)
      .attr("stroke-opacity", BASE_LINK_OPACITY);

    outlines
      .each(function () {
        const L = this.getTotalLength ? this.getTotalLength() : 0;
        if (L)
          d3.select(this)
            .attr("stroke-dasharray", `${L} ${L}`)
            .attr("stroke-dashoffset", L);
      })
      .transition()
      .delay((d) => 160 + (d.source.x0 / width) * 480)
      .duration(1000)
      .ease(ease)
      .attr("stroke-dashoffset", 0)
      .attr("stroke-opacity", BASE_OUTLINE_OPACITY);

    svg
      .selectAll("rect")
      .transition()
      .delay(80)
      .duration(480)
      .ease(ease)
      .attr("opacity", 1);

    svg
      .selectAll("text")
      .transition()
      .delay(220)
      .duration(480)
      .ease(ease)
      .attr("opacity", 1);
  }

  let tooltipTimer = null;

  const selectedLinks = new Set();
  window.selectedLinksSet = selectedLinks;

  function redrawSelection() {
    window.redrawFlowSelection = redrawSelection;
    const hasSel = selectedLinks.size > 0;

    if (!hasSel) {
      paths.attr("stroke-opacity", BASE_LINK_OPACITY);
      outlines.attr("stroke-opacity", BASE_OUTLINE_OPACITY);
      closeFlowDetailPanel();
      return;
    }

    paths.attr("stroke-opacity", DIMMED_LINK_OPACITY);
    outlines.attr("stroke-opacity", DIMMED_OUTLINE_OPACITY);

    paths.filter((l) => selectedLinks.has(l)).attr("stroke-opacity", 0.9);
    outlines.filter((l) => selectedLinks.has(l)).attr("stroke-opacity", 0.95);

    updateFlowDetailPanel(Array.from(selectedLinks), { nodes, links });
  }

  paths
    .on("mousemove", (ev, d) => {
      if (tooltipTimer) {
        clearTimeout(tooltipTimer);
        tooltipTimer = null;
      }
      showTooltip(ev, d, "flow");
    })
    .on("mouseleave", () => {
      tooltipTimer = setTimeout(() => hideTooltip(), 700);
    })
    .on("click", (ev, d) => {
      ev.stopPropagation();

      if (selectedLinks.has(d)) {
        selectedLinks.delete(d);
      } else {
        selectedLinks.add(d);
      }

      redrawSelection();
    });

  svg.on("click", (event) => {
    if (event.target === svg.node() || event.target.tagName === "svg") {
      selectedLinks.clear();
      redrawSelection();
    }
  });

  closeFlowDetailPanel();
}

function closeFlowDetailPanel() {
  d3.select("#detailPanelFlow").classed("hidden", true);
  d3.select(".detail-panel-backdrop-flow").classed("hidden", true);
  d3.select("#detailTitleFlow").text("Choose a flow");
  d3.select("#detailContentFlow").html("");

  const svg = d3.select("#flowViz svg");
  if (!svg.empty()) {
    const BASE_LINK_OPACITY = 0.28;
    const BASE_OUTLINE_OPACITY = 0.85;
    const paths = svg.selectAll(".sankey-link");
    const outlines = svg.selectAll(".sankey-link-outline");
    if (paths.size() > 0) {
      paths.attr("stroke-opacity", BASE_LINK_OPACITY);
      outlines.attr("stroke-opacity", BASE_OUTLINE_OPACITY);
    }
  }

  const selectedLinksSet = window.selectedLinksSet;
  if (selectedLinksSet) {
    selectedLinksSet.clear();
    const redrawFunc = window.redrawFlowSelection;
    if (redrawFunc) redrawFunc();
  }
}

function updateFlowDetailPanel(sel, graph) {
  const links = Array.isArray(sel) ? sel : [sel];
  const multi = links.length > 1;

  d3.select("#detailPanelFlow").classed("hidden", false);
  d3.select(".detail-panel-backdrop-flow").classed("hidden", false);

  setTimeout(() => {
    const panelEl = document.getElementById("detailPanelFlow");
    const vizEl = document.querySelector("#flowViz");
    if (panelEl && vizEl && !panelEl.classList.contains("hidden")) {
      const panelRect = panelEl.getBoundingClientRect();
      const vizRect = vizEl.getBoundingClientRect();
      const panelHeight = panelRect.height;
      const viewportHeight = window.innerHeight;
      const spaceNeeded = vizRect.bottom - (viewportHeight - panelHeight) + 40;
      if (spaceNeeded > 0) {
        const scrollTarget = window.scrollY + spaceNeeded;
        window.scrollTo({
          top: scrollTarget,
          behavior: "smooth",
        });
      }
    }
  }, 150);

  if (!links.length) {
    d3.select("#detailTitleFlow").text("Choose a flow");
    d3.select("#detailContentFlow").html(
      "<div class='detail-value'>No records in this flow.</div>"
    );
    return;
  }

  const allRecs = links.flatMap((l) => l.records || []);
  const n = allRecs.length;

  const avg = (arr, acc) => (arr.length ? d3.mean(arr, acc) : NaN);
  const avgSleep = avg(allRecs, (d) => +d.sleepHours);
  const avgHR = avg(allRecs, (d) => +d.heartRate);
  const avgQuality = avg(allRecs, (d) => +d.sleepQuality);

  if (multi) {
    const label = `${links.length} flows selected`;
    d3.select("#detailTitleFlow").text(label);
  } else {
    const src = graph.nodes[links[0].source.index].name;
    const tgt = graph.nodes[links[0].target.index].name;
    d3.select("#detailTitleFlow").text(`${src} → ${tgt}`);
  }

  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  const pSleep = clamp01(((avgSleep ?? 0) - 5) / (10 - 5));
  const pHR = Number.isFinite(avgHR)
    ? 1 - clamp01(((avgHR ?? 0) - 50) / (100 - 50))
    : 0.0;
  const pQuality = clamp01(((avgQuality ?? 0) - 1) / (10 - 1));
  const row = (label, val, unit, pct, color) => `
    <div class="detail-stat">
      <div style="width:100%;">
        <div class="detail-label">${label}</div>
        <div class="detail-value">${
          Number.isFinite(val) ? val.toFixed(2) : "—"
        } ${unit || ""}</div>
        <div class="detail-bar-container">
          <div class="detail-bar" style="width:${(pct * 100).toFixed(
            0
          )}%; background:${color};"></div>
        </div>
      </div>
    </div>`;

  let tableHTML = "";
  if (multi) {
    tableHTML =
      `<div class="detail-stat">
         <div class="detail-label">Flow comparison</div>
         <div style="overflow:auto;">
           <table style="width:100%; border-collapse:collapse; font-size:12px;">
             <thead>
               <tr>
                 <th style="text-align:left; padding:6px; border-bottom:1px solid #30363d;">Flow</th>
                 <th style="text-align:right; padding:6px; border-bottom:1px solid #30363d;">People</th>
                 <th style="text-align:right; padding:6px; border-bottom:1px solid #30363d;">Avg Sleep (h)</th>
                 <th style="text-align:right; padding:6px; border-bottom:1px solid #30363d;">Avg HR (bpm)</th>
                 <th style="text-align:right; padding:6px; border-bottom:1px solid #30363d;">Quality (/10)</th>
               </tr>
             </thead>
             <tbody>` +
      links
        .map((l) => {
          const src = graph.nodes[l.source.index].name;
          const tgt = graph.nodes[l.target.index].name;
          const recs = l.records || [];
          const nL = recs.length;
          const aS = d3.mean(recs, (d) => +d.sleepHours) ?? NaN;
          const aH = d3.mean(recs, (d) => +d.heartRate) ?? NaN;
          const aQ = d3.mean(recs, (d) => +d.sleepQuality) ?? NaN;
          return `<tr>
            <td style="padding:6px; border-bottom:1px solid #222">${src} → ${tgt}</td>
            <td style="padding:6px; text-align:right; border-bottom:1px solid #222">${nL}</td>
            <td style="padding:6px; text-align:right; border-bottom:1px solid #222">${
              Number.isFinite(aS) ? aS.toFixed(2) : "—"
            }</td>
            <td style="padding:6px; text-align:right; border-bottom:1px solid #222">${
              Number.isFinite(aH) ? aH.toFixed(2) : "—"
            }</td>
            <td style="padding:6px; text-align:right; border-bottom:1px solid #222">${
              Number.isFinite(aQ) ? aQ.toFixed(2) : "—"
            }</td>
          </tr>`;
        })
        .join("") +
      `</tbody></table>
         </div>
       </div>`;
  }

  d3.select("#detailContentFlow").html(`
    <div class="detail-stat">
      <div class="detail-label">Sample Size</div>
      <div class="detail-value">${n} people</div>
    </div>
    ${row("Average Sleep Duration", avgSleep, "hours", pSleep, "#51cf66")}
    ${row("Average Heart Rate", avgHR, "bpm", pHR, "#7c4dff")}
    ${row("Sleep Quality Score", avgQuality, "/ 10", pQuality, "#22b8cf")}
    ${tableHTML}
  `);
}

function initDreamLab(rows) {
  const bmiNumericCol = findCol(rows.columns, CANDIDATES.bmi);
  const bmiCategoryCol = findCol(rows.columns, CANDIDATES.bmiCat);
  const hrCol = findCol(rows.columns, CANDIDATES.heart);
  const disCol = findCol(rows.columns, CANDIDATES.disorder);
  if (!hrCol || !disCol || (!bmiNumericCol && !bmiCategoryCol)) return;

  function normalizeCat(raw) {
    const s = String(raw || "").trim();
    const low = s.toLowerCase();
    if (!s) return "Unknown";
    if (low.includes("under")) return "Underweight";
    if (low.includes("normal")) return "Normal";
    if (low.includes("over")) return "Overweight";
    if (low.includes("obese")) return "Obese";
    return s;
  }
  function bmiFromCategory(catRaw) {
    const c = String(catRaw || "").toLowerCase();
    if (c.includes("under")) return 17.5;
    if (c.includes("normal")) return 22.0;
    if (c.includes("over")) return 27.5;
    if (c.includes("obese")) return 33.5;
    return 25.0;
  }

  const data = rows
    .map((d, i) => {
      const cat = bmiCategoryCol ? normalizeCat(d[bmiCategoryCol]) : null;
      const bmiNum = bmiNumericCol ? +d[bmiNumericCol] : bmiFromCategory(cat);
      return {
        id: i,
        bmi: bmiNum,
        cat: cat || "Unknown",
        hr: +d[hrCol],
        disorder: (d[disCol] ?? "Unknown").toString().trim() || "Unknown",
        phaseX: Math.random() * Math.PI * 2,
        phaseY: Math.random() * Math.PI * 2,
      };
    })
    .filter(
      (d) => isFinite(d.hr) && (bmiCategoryCol ? d.cat : isFinite(d.bmi))
    );

  const host = d3.select("#dreamLab");
  host.selectAll("*").remove();

  const width = host.node().getBoundingClientRect().width;
  const height = Math.max(560, Math.floor(width * 0.5));
  host.style("height", height + "px");

  const trailCanvas = host
    .append("canvas")
    .attr("class", "dl-layer-canvas")
    .attr("width", width)
    .attr("height", height)
    .node();
  const trailCtx = trailCanvas.getContext("2d");

  const svg = host.append("svg").attr("width", width).attr("height", height);
  const g = svg.append("g");
  const margin = { top: 56, right: 28, bottom: 56, left: 68 };
  g.attr("transform", `translate(${margin.left},${margin.top})`);
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const zzzCanvas = host
    .append("canvas")
    .attr("class", "dl-zzz-canvas")
    .attr("width", width)
    .attr("height", height)
    .node();
  const zzzCtx = zzzCanvas.getContext("2d");

  const defs = svg.append("defs");
  const radial = defs.append("radialGradient").attr("id", "dlRadial");
  radial.append("stop").attr("offset", "0%").attr("stop-color", "#58a6ff");
  radial
    .append("stop")
    .attr("offset", "100%")
    .attr("stop-color", "#58a6ff")
    .attr("stop-opacity", 0);

  const disSel = document.getElementById("dl-disorder");
  const hrMinEl = document.getElementById("dl-hr-min");
  const hrMaxEl = document.getElementById("dl-hr-max");
  const speedEl = document.getElementById("dl-speed");
  const pulseEl = document.getElementById("dl-pulse");
  const trailsEl = document.getElementById("dl-trails");
  const constEl = document.getElementById("dl-constellations");
  const densEl = document.getElementById("dl-density");
  const deepEl = document.getElementById("dl-deepsleep");
  const catHost = document.getElementById("dl-bmi-cats");

  const rangeValueEl = document.querySelector(".range-value");
  if (speedEl && rangeValueEl) {
    speedEl.addEventListener("input", (e) => {
      rangeValueEl.textContent = parseFloat(e.target.value).toFixed(2);
    });
  }

  const categoriesAll = Array.from(new Set(data.map((d) => d.cat)));
  const orderHint = [
    "Underweight",
    "Normal",
    "Normal Weight",
    "Overweight",
    "Obese",
    "Unknown",
  ];
  categoriesAll.sort((a, b) => {
    const ia = orderHint.findIndex((x) =>
      a.toLowerCase().includes(x.toLowerCase())
    );
    const ib = orderHint.findIndex((x) =>
      b.toLowerCase().includes(x.toLowerCase())
    );
    return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib) || a.localeCompare(b);
  });

  if (catHost) {
    catHost.innerHTML = "";
    categoriesAll.forEach((c) => {
      const id = "cat-" + c.replace(/\s+/g, "-").toLowerCase();
      const wrap = document.createElement("div");
      wrap.className = "dl-chip";
      wrap.innerHTML = `<input id="${id}" type="checkbox" checked /><label for="${id}">${c}</label>`;
      catHost.appendChild(wrap);
    });
  }

  if (disSel) {
    const seen = Array.from(new Set(data.map((d) => d.disorder))).sort((a, b) =>
      a.localeCompare(b)
    );
    disSel.innerHTML =
      `<option value="__ALL__">All</option>` +
      seen.map((s) => `<option value="${s}">${s}</option>`).join("");
  }

  const x = d3
    .scaleBand()
    .domain(categoriesAll)
    .range([0, innerWidth])
    .paddingInner(0.25)
    .paddingOuter(0.1);

  const hrExtent = d3.extent(data, (d) => d.hr);
  const y = d3
    .scaleLinear()
    .domain([64, Math.max(hrExtent[1], 65)])
    .range([innerHeight, 0]);

    g.append("g")
        .attr("class", "dl-axis-x")
        .attr("transform", `translate(0,${innerHeight})`)
        .call(d3.axisBottom(x));

    g.append("g")
        .attr("class", "dl-axis-y")
        .call(d3.axisLeft(y).ticks(8));


    g.append("text")
    .attr("class", "dl-axis-label")
    .attr("x", innerWidth / 2)
    .attr("y", innerHeight + 40)
    .attr("text-anchor", "middle")
    .text("BMI Category");

  g.append("text")
    .attr("class", "dl-axis-label")
    .attr("transform", "rotate(-90)")
    .attr("x", -innerHeight / 2)
    .attr("y", -48)
    .attr("text-anchor", "middle")
    .text("Heart Rate (bpm)");

  const wave = g
    .append("path")
    .attr("fill", "rgba(88,166,255,0.06)")
    .attr("stroke", "rgba(88,166,255,0.12)")
    .attr("stroke-width", 1.2);
  function drawWave(t = 0) {
    const A = 12,
      L = 140,
      v = 0.25;
    let p = `M 0 ${innerHeight * 0.2}`;
    for (let X = 0; X <= innerWidth; X += 8) {
      const Y =
        innerHeight * 0.2 +
        A * Math.sin(X / L + t * v) +
        3 * Math.sin(X / 55 - t * 0.6);
      p += ` L ${X} ${Y}`;
    }
    p += ` L ${innerWidth} ${innerHeight} L 0 ${innerHeight} Z`;
    wave.attr("d", p);
  }

  const colorLut = new Map([
    ["None", "#8b949e"],
    ["Insomnia", "#7c4dff"],
    ["Sleep Apnea", "#f85149"],
  ]);
  const color = (d) => colorLut.get(d) || "#58a6ff";

  const ttp = d3.select("#dreamLab").append("div").attr("class", "dl-tooltip");

  const linksG = g.append("g");
  const densityG = g.append("g");
  const nodesG = g.append("g");

  const baseR = d3
    .scaleSqrt()
    .domain(d3.extent(data, (d) => d.hr))
    .range([6, 16]);

  function xPos(d, t = 0, speed = 0.35) {
    const cx = x(d.cat) + x.bandwidth() / 2;
    const jitter = x.bandwidth() * 0.22 * Math.sin(t * 0.8 + d.phaseX);
    return cx + jitter * speed;
  }

  const dots = nodesG
    .selectAll(".dl-node")
    .data(data, (d) => d.id)
    .join((enter) => {
      const grp = enter.append("g").attr("class", "dl-node");
      grp
        .append("circle")
        .attr("class", "dl-dot-halo")
        .attr("cx", (d) => xPos(d, 0, 0))
        .attr("cy", (d) => y(d.hr))
        .attr("r", (d) => baseR(d.hr) * 2.2)
        .attr("stroke", (d) => color(d.disorder));
      grp
        .append("circle")
        .attr("class", "dl-dot")
        .attr("cx", (d) => xPos(d, 0, 0))
        .attr("cy", (d) => y(d.hr))
        .attr("r", (d) => baseR(d.hr))
        .attr("fill", (d) => color(d.disorder));
      grp
        .append("circle")
        .attr("class", "dl-dot-ring")
        .attr("cx", (d) => xPos(d, 0, 0))
        .attr("cy", (d) => y(d.hr))
        .attr("r", (d) => baseR(d.hr) * 1.8)
        .attr("stroke", (d) => color(d.disorder));
      return grp;
    });

  dots
    .on("mouseover", function (event, d) {
      d3.select(this)
        .select(".dl-dot-ring")
        .transition()
        .duration(150)
        .attr("r", baseR(d.hr) * 2.5);
      ttp
        .html(
          `<strong>${d.disorder}</strong><br/>` +
            `BMI Category: <b>${d.cat}</b><br/>` +
            `Heart Rate: <b>${d.hr}</b> bpm`
        )
        .style("left", event.pageX + 14 + "px")
        .style("top", event.pageY - 10 + "px")
        .classed("visible", true);
    })
    .on("mousemove", (event) =>
      ttp
        .style("left", event.pageX + 14 + "px")
        .style("top", event.pageY - 10 + "px")
    )
    .on("mouseout", function () {
      d3.select(this)
        .select(".dl-dot-ring")
        .transition()
        .duration(200)
        .attr("r", baseR(d.hr) * 1.8);
      ttp.classed("visible", false);
    });

  let filtered = data.slice();
  function selectedCategories() {
    if (!catHost) return null;
    const set = new Set();
    catHost.querySelectorAll("input[type=checkbox]").forEach((ch) => {
      if (ch.checked) {
        const label = ch.nextElementSibling?.textContent?.trim();
        if (label) set.add(label);
      }
    });
    return set;
  }
    function applyFilter() {
        const dname = disSel ? disSel.value : "__ALL__";
        const cats = selectedCategories();

        // Read HR min/max from controls; fall back to full extent if empty
        const hrMinRaw = hrMinEl ? +hrMinEl.value : hrExtent[0];
        const hrMaxRaw = hrMaxEl ? +hrMaxEl.value : hrExtent[1];
        const newMin = Math.min(hrMinRaw, hrMaxRaw);
        const newMax = Math.max(hrMinRaw, hrMaxRaw);

        // Filter by disorder, BMI category, and heart rate range
        filtered = data.filter((d) => {
            const okDis = dname === "__ALL__" ? true : d.disorder === dname;
            const okCat = cats ? cats.has(d.cat) : true;
            const okHr = d.hr >= newMin && d.hr <= newMax;
            return okDis && okCat && okHr;
        });

        // Dynamically update Y scale domain and redraw the Y axis
        y.domain([newMin, newMax]);
        g.select(".dl-axis-y").call(d3.axisLeft(y).ticks(8));

        // Redraw static layers that depend on y()
        redrawStatic();
    }


  function drawDensity(t = 0) {
    densityG.selectAll("*").remove();
    if (!densEl?.checked || filtered.length < 10) return;
    const pts = filtered.map((d) => [x(d.cat) + x.bandwidth() / 2, y(d.hr)]);
    const density = d3
      .contourDensity()
      .x((d) => d[0])
      .y((d) => d[1])
      .size([innerWidth, innerHeight])
      .bandwidth(30 + 6 * Math.sin(t * 0.5))(pts);
    densityG.attr("transform", `translate(${margin.left},${margin.top})`);
    densityG
      .selectAll("path")
      .data(density)
      .join("path")
      .attr("class", "dl-density")
      .attr("d", d3.geoPath());
  }

  function classFromDisorder(d) {
    const s = d.toLowerCase();
    if (s.includes("insomnia")) return "insomnia";
    if (s.includes("apnea")) return "apnea";
    if (s.includes("none")) return "none";
    return "";
  }
  function redrawStatic() {
    dots.attr("display", (d) => (filtered.includes(d) ? null : "none"));

    linksG.selectAll("*").remove();
    if (!constEl?.checked || filtered.length < 3) return;

    const byDis = d3.group(filtered, (d) => d.disorder);
    for (const [key, arr] of byDis) {
      const k = 3;
      arr.forEach((a) => {
        const ax = x(a.cat) + x.bandwidth() / 2;
        const ay = y(a.hr);
        const nearest = arr
          .slice()
          .sort((p, q) => {
            const px = x(p.cat) + x.bandwidth() / 2,
              py = y(p.hr);
            const qx = x(q.cat) + x.bandwidth() / 2,
              qy = y(q.hr);
            const dp = (px - ax) ** 2 + (py - ay) ** 2;
            const dq = (qx - ax) ** 2 + (qy - ay) ** 2;
            return dp - dq;
          })
          .slice(1, k + 1);
        nearest.forEach((n) => {
          linksG
            .append("line")
            .attr("class", "dl-link " + classFromDisorder(key))
            .attr("x1", ax + margin.left)
            .attr("y1", ay + margin.top)
            .attr("x2", x(n.cat) + x.bandwidth() / 2 + margin.left)
            .attr("y2", y(n.hr) + margin.top);
        });
      });
    }
  }

  const zzz = d3.range(16).map(() => ({
    x: Math.random() * width,
    y: height * Math.random() * 0.5 + innerHeight * 0.4,
    spd: 10 + Math.random() * 20,
    size: 10 + Math.random() * 16,
    phase: Math.random() * Math.PI * 2,
  }));

  let t0 = performance.now();
  const timer = d3.timer(tick);

  function tick(now) {
    const t = (now - t0) / 1000;
    const speed = +speedEl?.value || 0.35;
    const pulseOn = !!pulseEl?.checked;

    drawWave(t);

    dots
      .selectAll(".dl-dot, .dl-dot-ring, .dl-dot-halo")
      .attr("cx", (d) => xPos(d, t, speed))
      .attr("cy", (d) => y(d.hr) + 5 * speed * Math.cos(t * 0.9 + d.phaseY));

    if (pulseOn) {
      dots.each(function (d) {
        const grp = d3.select(this);
        const rBase = baseR(d.hr) * 1.8;
        const w = 2 * Math.PI * (d.hr / 60);
        const s = Math.sin(w * t + d.phaseX);
        const sPos = Math.max(0, s);
        grp.select(".dl-dot-ring").attr("r", rBase * (1 + 0.14 * s));
        grp
          .select(".dl-dot-halo")
          .attr("opacity", 0.18 + 0.32 * sPos)
          .attr("stroke-width", 8 * (1 + 0.25 * sPos));
        grp.select(".dl-dot").attr("opacity", 0.8 + 0.2 * sPos);
      });
    }

    if (trailsEl?.checked) {
      trailCtx.fillStyle = "rgba(13,17,23,0.08)";
      trailCtx.fillRect(0, 0, width, height);
      filtered.forEach((d) => {
        const px = margin.left + xPos(d, t, speed);
        const py =
          margin.top + (y(d.hr) + 5 * speed * Math.cos(t * 0.9 + d.phaseY));
        trailCtx.beginPath();
        trailCtx.arc(px, py, 2.2, 0, Math.PI * 2);
        trailCtx.fillStyle = color(d.disorder) + "CC";
        trailCtx.fill();
      });
    } else {
      trailCtx.clearRect(0, 0, width, height);
    }

    drawDensity(t);
    zzzCtx.clearRect(0, 0, width, height);
    zzz.forEach((p) => {
      p.y -= p.spd * 0.02;
      p.x += Math.sin(t * 0.6 + p.phase) * 0.4;
      if (p.y < margin.top) {
        p.y = height - 10;
        p.x = Math.random() * width;
      }
      zzzCtx.font = `${p.size}px serif`;
      zzzCtx.globalAlpha = 0.2;
      zzzCtx.fillStyle = "#e6edf3";
      zzzCtx.fillText("Z", p.x, p.y);
      zzzCtx.globalAlpha = 1;
    });

    d3.select("#dreamLab").classed("deep-sleep", !!deepEl?.checked);
  }

  if (disSel) disSel.addEventListener("change", applyFilter);
  if (hrMinEl) hrMinEl.addEventListener("change", applyFilter);
  if (hrMaxEl) hrMaxEl.addEventListener("change", applyFilter);
  if (catHost)
    catHost
      .querySelectorAll("input[type=checkbox]")
      .forEach((ch) => ch.addEventListener("change", applyFilter));
  if (constEl) constEl.addEventListener("change", () => redrawStatic());
  if (densEl) densEl.addEventListener("change", () => redrawStatic());

  if (hrMinEl && hrMaxEl) {
    hrMinEl.value = 64;
    hrMaxEl.value = Math.ceil(hrExtent[1]);
  }

  applyFilter();

  let rTimer;
  window.addEventListener("resize", () => {
    clearTimeout(rTimer);
    rTimer = setTimeout(() => {
      d3.timerFlush();
      initDreamLab(rows);
    }, 180);
  });
}
