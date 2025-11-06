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
  .range(["#51cf66", "#ffd43b", "#ff6b6b"])
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

function generateInsights() {
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

  const sizeScale = d3
    .scaleSqrt()
    .domain([0, d3.max(state.jobData, (d) => d.count)])
    .range([10, 60]);

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

  const individualDotsGroup = g.append("g").attr("class", "individual-dots");
  const bubblesGroup = g.append("g").attr("class", "bubbles");

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

  svg.on("click", function () {
    if (state.selectedJob) {
      state.selectedJob = null;
      updateBubbleSelection();
    }
  });

  updateBubbleSelection();

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

      individualDotsGroup
        .selectAll(".individual-dot")
        .data(selectedJobData.individuals)
        .join(
          (enter) =>
            enter
              .append("circle")
              .attr("class", "individual-dot")
              .attr("cx", (d) => xScale(d.sleep))
              .attr("cy", (d) => yScale(d.stress))
              .attr("r", 0)
              .call((enter) =>
                enter
                  .transition()
                  .duration(500)
                  .delay((d, i) => i * 20)
                  .attr("r", 4)
              ),
          (update) => update,
          (exit) => exit.transition().duration(300).attr("r", 0).remove()
        )
        .on("mouseover", function (event, d) {
          d3.select(this).transition().duration(150).attr("r", 6);
          showTooltip(event, d, "individual");
        })
        .on("mouseout", function () {
          d3.select(this).transition().duration(150).attr("r", 4);
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

      d3.select("#detailPanel")
        .classed("hidden", true)
        .select("#detailTitle")
        .text("Select an element to see details");

      d3.select("#detailContent").html("");
    }
  }

  function updateDetailPanel(jobData) {
    d3.select("#detailPanel").classed("hidden", false);
    d3.select("#detailTitle").text(jobData.job);

    const maxSleep = d3.max(state.jobData, (d) => d.avgSleep);
    const maxStress = d3.max(state.jobData, (d) => d.avgStress);
    const maxQuality = state.cols.quality
      ? d3.max(state.jobData, (d) => d.avgQuality)
      : 10;
    const maxActivity = state.cols.activity
      ? d3.max(state.jobData, (d) => d.avgActivity)
      : 100;

    let detailHTML = `
      <div class="detail-stat">
        <div>
          <div class="detail-label">Sample Size</div>
          <div class="detail-value">${jobData.count} people</div>
        </div>
      </div>
      <div class="detail-stat">
        <div style="width: 100%;">
          <div class="detail-label">Average Sleep</div>
          <div class="detail-value">${jobData.avgSleep.toFixed(2)} hours</div>
          <div class="detail-bar-container">
            <div class="detail-bar" style="width: ${
              (jobData.avgSleep / maxSleep) * 100
            }%; background: #51cf66;"></div>
          </div>
        </div>
      </div>
      <div class="detail-stat">
        <div style="width: 100%;">
          <div class="detail-label">Average Stress</div>
          <div class="detail-value">${jobData.avgStress.toFixed(2)}</div>
          <div class="detail-bar-container">
            <div class="detail-bar" style="width: ${
              (jobData.avgStress / maxStress) * 100
            }%; background: ${stressColorScale(jobData.avgStress)};"></div>
          </div>
        </div>
      </div>
    `;

    if (jobData.avgQuality) {
      detailHTML += `
        <div class="detail-stat">
          <div style="width: 100%;">
            <div class="detail-label">Sleep Quality</div>
            <div class="detail-value">${jobData.avgQuality.toFixed(2)}</div>
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
      detailHTML += `
        <div class="detail-stat">
          <div style="width: 100%;">
            <div class="detail-label">Physical Activity</div>
            <div class="detail-value">${jobData.avgActivity.toFixed(1)}</div>
            <div class="detail-bar-container">
              <div class="detail-bar" style="width: ${
                (jobData.avgActivity / maxActivity) * 100
              }%; background: #4dabf7;"></div>
            </div>
          </div>
        </div>
      `;
    }

    d3.select("#detailContent").html(detailHTML);
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

    // === Neuer: Selektion & Tooltip-Delay ===
    let selected = new Set(); // enthält Indizes ausgewählter Links
    let flowTtpTimer = null;

    const gLinks = svg.append("g");
    const gLinkOutlines = gLinks.append("g"); // Outline-Schicht
    const gLinkColors = gLinks.append("g");   // Farbschicht oben

    // --- Outline-Pfade (erhöht Kontrast bei Überlappungen) ---
    const outlines = gLinkOutlines
        .selectAll("path")
        .data(links)
        .join("path")
        .attr("class", "sankey-link-outline")
        .attr("d", d3.sankeyLinkHorizontal())
        .attr("stroke", "#0d1117")              // dunkler Hintergrund-Ton
        .attr("stroke-width", (d) => Math.max(1, d.width) + 4) // minimal breiter
        .attr("stroke-opacity", 0.85)
        .attr("fill", "none");

    // --- Farbpunkte (eigentliche Links) ---
    const paths = gLinkColors
        .selectAll("path")
        .data(links)
        .join("path")
        .attr("class", "sankey-link")
        .attr("d", d3.sankeyLinkHorizontal())
        .attr("stroke", (d) => flowColorScale(nodes[d.source.index].name))
        .attr("stroke-width", (d) => Math.max(1, d.width))
        .attr("stroke-opacity", 0.28)
        .attr("fill", "none")
        .style("cursor", "pointer")
        .on("mousemove", (ev, d) => {
            if (flowTtpTimer) {
                clearTimeout(flowTtpTimer);
                flowTtpTimer = null;
            }
            showTooltip(ev, d, "flow");
        })
        .on("mouseleave", () => {
            // Tooltip verschwindet verzögert (persistenter Effekt)
            flowTtpTimer = setTimeout(() => hideTooltip(), 700);
        })
        .on("click", (ev, d) => {
            // Toggle Auswahl
            const idx = links.indexOf(d);
            if (selected.has(idx)) selected.delete(idx);
            else selected.add(idx);

            updateLinkAppearance();
            // Update Detail-Panel: einzelne Auswahl ODER mehrere
            const selLinks = Array.from(selected).map((i) => links[i]);
            updateFlowDetailPanel(selLinks.length ? selLinks : d, { nodes, links });

            ev.stopPropagation();
        });

    // Knoten & Labels (unverändert)
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
        .attr("stroke", (d) => d3.color(flowColorScale(d.name)).darker(0.7));

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
        .text((d) => `${d.name} (${d.value})`);

    svg
        .append("rect")
        .attr("x", 8)
        .attr("y", 8)
        .attr("width", width - 16)
        .attr("height", height - 16)
        .attr("rx", 12)
        .attr("fill", "none")
        .attr("stroke", "#30363d");

    // Klick auf freie Fläche: Auswahl zurücksetzen
    svg.on("click", () => {
        if (selected.size) {
            selected.clear();
            updateLinkAppearance();
            d3.select("#detailPanelFlow")
                .classed("hidden", true)
                .select("#detailTitleFlow")
                .text("Select an element to see details");
            d3.select("#detailContentFlow").html("");
        }
    });

    d3.select("#detailPanelFlow")
        .classed("hidden", true)
        .select("#detailTitleFlow")
        .text("Select an element to see details");
    d3.select("#detailContentFlow").html("");

    // --- Aussehen abhängig von Auswahl-Zustand (inkl. Transition) ---
    function updateLinkAppearance() {
        const hasSel = selected.size > 0;

        outlines
            .transition()
            .duration(250)
            .attr("stroke-opacity", (d, i) =>
                hasSel ? (selected.has(i) ? 0.95 : 0.15) : 0.85
            );

        paths
            .transition()
            .duration(250)
            .attr("stroke-opacity", (d, i) =>
                hasSel ? (selected.has(i) ? 0.9 : 0.08) : 0.28
            );
    }
}

function updateFlowDetailPanel(sel, graph) {
    // sel kann ein einzelner Link (Objekt) oder ein Array von Links sein
    const links = Array.isArray(sel) ? sel : [sel];
    const multi = links.length > 1;

    d3.select("#detailPanelFlow").classed("hidden", false);

    if (!links.length) {
        d3.select("#detailTitleFlow").text("Choose a flow");
        d3.select("#detailContentFlow").html(
            "<div class='detail-value'>No records in this flow.</div>"
        );
        return;
    }

    // Records zusammenführen
    const allRecs = links.flatMap((l) => l.records || []);
    const n = allRecs.length;

    // Kennzahlen (gewichtete Mittel über alle Rekorde)
    const avg = (arr, acc) => (arr.length ? d3.mean(arr, acc) : NaN);
    const avgSleep = avg(allRecs, (d) => +d.sleepHours);
    const avgHR = avg(allRecs, (d) => +d.heartRate);
    const avgQuality = avg(allRecs, (d) => +d.sleepQuality);

    // Überschrift
    if (multi) {
        const label = `${links.length} flows selected`;
        d3.select("#detailTitleFlow").text(label);
    } else {
        const src = graph.nodes[links[0].source.index].name;
        const tgt = graph.nodes[links[0].target.index].name;
        d3.select("#detailTitleFlow").text(`${src} → ${tgt}`);
    }

    // Balkenberechnung wie bisher
    const clamp01 = (x) => Math.max(0, Math.min(1, x));
    const pSleep = clamp01(((avgSleep ?? 0) - 5) / (10 - 5));
    const pHR = Number.isFinite(avgHR) ? 1 - clamp01(((avgHR ?? 0) - 50) / (100 - 50)) : 0.0;
    const pQuality = clamp01(((avgQuality ?? 0) - 1) / (10 - 1));
    const row = (label, val, unit, pct, color) => `
    <div class="detail-stat">
      <div style="width:100%;">
        <div class="detail-label">${label}</div>
        <div class="detail-value">${Number.isFinite(val) ? val.toFixed(2) : "—"} ${unit || ""}</div>
        <div class="detail-bar-container">
          <div class="detail-bar" style="width:${(pct * 100).toFixed(0)}%; background:${color};"></div>
        </div>
      </div>
    </div>`;

    // Vergleichstabelle bei Mehrfachauswahl
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
            <td style="padding:6px; text-align:right; border-bottom:1px solid #222">${Number.isFinite(aS) ? aS.toFixed(2) : "—"}</td>
            <td style="padding:6px; text-align:right; border-bottom:1px solid #222">${Number.isFinite(aH) ? aH.toFixed(2) : "—"}</td>
            <td style="padding:6px; text-align:right; border-bottom:1px solid #222">${Number.isFinite(aQ) ? aQ.toFixed(2) : "—"}</td>
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
    .attr("class", "dl-axis")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x));

  g.append("g").attr("class", "dl-axis").call(d3.axisLeft(y).ticks(8));

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
    ["Narcolepsy", "#ffd43b"],
    ["Restless Leg Syndrome", "#3fb950"],
    ["Unknown", "#58a6ff"],
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
    const hrMin = +hrMinEl?.value || 0;
    const hrMax = +hrMaxEl?.value || 999;
    const cats = selectedCategories();

    filtered = data.filter((d) => {
      const okDis = dname === "__ALL__" ? true : d.disorder === dname;
      const okCat = cats ? cats.has(d.cat) : true;
      const okHr = d.hr >= hrMin && d.hr <= hrMax;
      return okDis && okCat && okHr;
    });

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
    if (s.includes("narco")) return "narco";
    if (s.includes("restless")) return "rls";
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

  // Zzz
  const zzz = d3.range(16).map(() => ({
    x: Math.random() * width,
    y: height * Math.random() * 0.5 + innerHeight * 0.4,
    spd: 10 + Math.random() * 20,
    size: 10 + Math.random() * 16,
    phase: Math.random() * Math.PI * 2,
  }));

  // Animation (drift + heartbeat)
  let t0 = performance.now();
  const timer = d3.timer(tick);

  function tick(now) {
    const t = (now - t0) / 1000;
    const speed = +speedEl?.value || 0.35;
    const pulseOn = !!pulseEl?.checked;

    drawWave(t);

    // Drift relative to categorical band center
    dots
      .selectAll(".dl-dot, .dl-dot-ring, .dl-dot-halo")
      .attr("cx", (d) => xPos(d, t, speed))
      .attr("cy", (d) => y(d.hr) + 5 * speed * Math.cos(t * 0.9 + d.phaseY));

    // Heartbeat synced to bpm
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

    // Trails
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

    // Density & zzz
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

    // Deep sleep tint
    d3.select("#dreamLab").classed("deep-sleep", !!deepEl?.checked);
  }

  // Wire controls
  if (disSel) disSel.addEventListener("change", applyFilter);
  if (hrMinEl) hrMinEl.addEventListener("change", applyFilter);
  if (hrMaxEl) hrMaxEl.addEventListener("change", applyFilter);
  if (catHost)
    catHost
      .querySelectorAll("input[type=checkbox]")
      .forEach((ch) => ch.addEventListener("change", applyFilter));
  if (constEl) constEl.addEventListener("change", () => redrawStatic());
  if (densEl) densEl.addEventListener("change", () => redrawStatic());

  // Initialize HR inputs to the data’s range (Y axis starts at 64)
  if (hrMinEl && hrMaxEl) {
    hrMinEl.value = 64;
    hrMaxEl.value = Math.ceil(hrExtent[1]);
  }

  // First draw
  applyFilter();

  // Rebuild on resize
  let rTimer;
  window.addEventListener("resize", () => {
    clearTimeout(rTimer);
    rTimer = setTimeout(() => {
      d3.timerFlush();
      initDreamLab(rows);
    }, 180);
  });
}
