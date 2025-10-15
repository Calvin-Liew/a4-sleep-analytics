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
};

const state = {
  cols: {},
  data: [],
  jobData: [],
  selectedJob: null,
};

function findCol(columns, names) {
  const lower = columns.map((c) => c.toLowerCase());
  for (const n of names) {
    const i = lower.indexOf(n.toLowerCase());
    if (i !== -1) return columns[i];
  }
  return null;
}

const stressColorScale = d3
  .scaleLinear()
  .domain([3, 5.5, 8])
  .range(["#51cf66", "#ffd43b", "#ff6b6b"])
  .interpolate(d3.interpolateRgb);

const tooltip = d3.select("body").append("div").attr("class", "tooltip");

d3.csv(FILE, d3.autoType).then((rows) => {
  state.cols.sleep = findCol(rows.columns, CANDIDATES.sleep);
  state.cols.stress = findCol(rows.columns, CANDIDATES.stress);
  state.cols.occupation = findCol(rows.columns, CANDIDATES.occupation);
  state.cols.quality = findCol(rows.columns, CANDIDATES.quality);
  state.cols.age = findCol(rows.columns, CANDIDATES.age);
  state.cols.activity = findCol(rows.columns, CANDIDATES.activity);

  if (!state.cols.sleep || !state.cols.stress || !state.cols.occupation) {
    console.error("Couldn't auto-detect column names.");
    alert("Error: Couldn't detect required columns in the dataset.");
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

  populateKeyFacts();
  generateInsights();
  initVisualization();

  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      initVisualization();
    }, 250);
  });
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
        updateSelection();
      } else {
        state.selectedJob = d.job;
        updateSelection();
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
      updateSelection();
    }
  });

  function updateSelection() {
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
        .text("Select a job to see details");

      d3.select("#detailContent").html("");
    }
  }

  function showTooltip(event, d, type) {
    let content = "";

    if (type === "job") {
      content = `
        <div class="tooltip-title">${d.job}</div>
        <div class="tooltip-stat">
          <span class="tooltip-label">People:</span>
          <span class="tooltip-value">${d.count}</span>
        </div>
        <div class="tooltip-stat">
          <span class="tooltip-label">Avg Sleep:</span>
          <span class="tooltip-value">${d.avgSleep.toFixed(2)}h</span>
        </div>
        <div class="tooltip-stat">
          <span class="tooltip-label">Avg Stress:</span>
          <span class="tooltip-value">${d.avgStress.toFixed(2)}</span>
        </div>
        ${
          d.avgQuality
            ? `<div class="tooltip-stat">
                <span class="tooltip-label">Avg Quality:</span>
                <span class="tooltip-value">${d.avgQuality.toFixed(2)}</span>
              </div>`
            : ""
        }
        ${
          d.avgActivity
            ? `<div class="tooltip-stat">
                <span class="tooltip-label">Avg Activity:</span>
                <span class="tooltip-value">${d.avgActivity.toFixed(1)}</span>
              </div>`
            : ""
        }
        <div style="margin-top: 12px; font-size: 11px; color: #8b949e; font-style: italic; padding-top: 8px; border-top: 1px solid #30363d;">
          Click to reveal individual stories
        </div>
      `;
    } else {
      content = `
        <div class="tooltip-title">Individual Worker</div>
        <div class="tooltip-stat">
          <span class="tooltip-label">Job:</span>
          <span class="tooltip-value">${d.job}</span>
        </div>
        <div class="tooltip-stat">
          <span class="tooltip-label">Sleep:</span>
          <span class="tooltip-value">${d.sleep}h</span>
        </div>
        <div class="tooltip-stat">
          <span class="tooltip-label">Stress:</span>
          <span class="tooltip-value">${d.stress}</span>
        </div>
        ${
          d.quality
            ? `<div class="tooltip-stat">
                <span class="tooltip-label">Quality:</span>
                <span class="tooltip-value">${d.quality}</span>
              </div>`
            : ""
        }
        ${
          d.age
            ? `<div class="tooltip-stat">
                <span class="tooltip-label">Age:</span>
                <span class="tooltip-value">${d.age}</span>
              </div>`
            : ""
        }
        ${
          d.activity
            ? `<div class="tooltip-stat">
                <span class="tooltip-label">Activity:</span>
                <span class="tooltip-value">${d.activity}</span>
              </div>`
            : ""
        }
      `;
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
