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
    heartRate: ["Heart Rate", "Resting Heart Rate", "heart_rate", "resting_hr", "Resting HR"],
};

const state = {
    cols: {},
    data: [], // Data for Bubble Chart
    jobData: [], // Aggregated data for Bubble Chart
    flowData: [], // Data for Sankey Diagram
    flowGraph: null, // Graph for Sankey Diagram
    selectedJob: null,
};

// Global Tooltip (used by both)
const tooltip = d3.select("body").append("div").attr("class", "tooltip");

// Stress Color Scale (from main.js)
const stressColorScale = d3
    .scaleLinear()
    .domain([3, 5.5, 8])
    .range(["#51cf66", "#ffd43b", "#ff6b6b"])
    .interpolate(d3.interpolateRgb);

// Sankey Color Scale (adapted from flow.js)
const flowColorScale = d3.scaleOrdinal()
    .domain(["Low", "Medium", "High", "Poor (5–6)", "Average (7)", "Good (8–10)"])
    .range(["#ef4444", "#f59e0b", "#22c55e", "#b91c1c", "#a16207", "#0f766e"]);


// ----- HELPER FUNCTIONS -----

function findCol(columns, names) {
    const lower = columns.map((c) => c.toLowerCase());
    for (const n of names) {
        const i = lower.indexOf(n.toLowerCase());
        if (i !== -1) return columns[i];
    }
    return null;
}

const sleepBucket = (q) => (q <= 6 ? "Poor (5–6)" : q === 7 ? "Average (7)" : "Good (8–10)");

// map activity → Low/Medium/High (from flow.js)
function buildActivityMapper(values){
    const nums = values.map(v => +v).filter(v => isFinite(v));
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
        return { label, domain:["Low","Medium","High"] };
    } else {
        const norm = s => String(s).trim().toLowerCase();
        const map = new Map([
            ["low","Low"],["minimal","Low"],["sedentary","Low"],
            ["medium","Medium"],["moderate","Medium"],
            ["high","High"],["vigorous","High"]
        ]);
        const label = (v) => map.get(norm(v)) || (String(v).charAt(0).toUpperCase()+String(v).slice(1));
        const domain = Array.from(new Set(values.map(label)));
        return { label, domain };
    }
}

// Tooltip helpers (combined and simplified)
function showTooltip(event, d, type) {
    let content = "";

    if (type === "job") {
        // Bubble Chart Job Tooltip
        content = `
      <div class="tooltip-title">${d.job}</div>
      <div class="tooltip-stat"><span class="tooltip-label">People:</span><span class="tooltip-value">${d.count}</span></div>
      <div class="tooltip-stat"><span class="tooltip-label">Avg Sleep:</span><span class="tooltip-value">${d.avgSleep.toFixed(2)}h</span></div>
      <div class="tooltip-stat"><span class="tooltip-label">Avg Stress:</span><span class="tooltip-value">${d.avgStress.toFixed(2)}</span></div>
      ${d.avgQuality ? `<div class="tooltip-stat"><span class="tooltip-label">Avg Quality:</span><span class="tooltip-value">${d.avgQuality.toFixed(2)}</span></div>` : ""}
      ${d.avgActivity ? `<div class="tooltip-stat"><span class="tooltip-label">Avg Activity:</span><span class="tooltip-value">${d.avgActivity.toFixed(1)}</span></div>` : ""}
      <div style="margin-top: 12px; font-size: 11px; color: #8b949e; font-style: italic; padding-top: 8px; border-top: 1px solid #30363d;">Click to reveal individual stories</div>
    `;
    } else if (type === "individual") {
        // Bubble Chart Individual Tooltip
        content = `
      <div class="tooltip-title">Individual Worker</div>
      <div class="tooltip-stat"><span class="tooltip-label">Job:</span><span class="tooltip-value">${d.job}</span></div>
      <div class="tooltip-stat"><span class="tooltip-label">Sleep:</span><span class="tooltip-value">${d.sleep}h</span></div>
      <div class="tooltip-stat"><span class="tooltip-label">Stress:</span><span class="tooltip-value">${d.stress}</span></div>
      ${d.quality ? `<div class="tooltip-stat"><span class="tooltip-label">Quality:</span><span class="tooltip-value">${d.quality}</span></div>` : ""}
      ${d.age ? `<div class="tooltip-stat"><span class="tooltip-label">Age:</span><span class="tooltip-value">${d.age}</span></div>` : ""}
      ${d.activity ? `<div class="tooltip-stat"><span class="tooltip-label">Activity:</span><span class="tooltip-value">${d.activity}</span></div>` : ""}
    `;
    } else if (type === "flow") {
        // Sankey Flow Tooltip
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


// ----- DATA LOADING AND PROCESSING -----

d3.csv(FILE, d3.autoType).then((rows) => {
    // 1. Column Detection (Combined)
    state.cols.sleep = findCol(rows.columns, CANDIDATES.sleep);
    state.cols.stress = findCol(rows.columns, CANDIDATES.stress);
    state.cols.occupation = findCol(rows.columns, CANDIDATES.occupation);
    state.cols.quality = findCol(rows.columns, CANDIDATES.quality);
    state.cols.age = findCol(rows.columns, CANDIDATES.age);
    state.cols.activity = findCol(rows.columns, CANDIDATES.activity);
    state.cols.heartRate = findCol(rows.columns, CANDIDATES.heartRate);

    if (!state.cols.sleep || !state.cols.stress || !state.cols.occupation || !state.cols.quality || !state.cols.activity) {
        console.error("Couldn't auto-detect all required columns.");
        alert("Error: Couldn't detect required columns in the dataset (need Sleep, Stress, Occupation, Quality, Activity).");
        return;
    }

    // 2. Data for Bubble Chart (main.js logic)
    state.data = rows
        .map((d) => ({
            sleep: +d[state.cols.sleep],
            stress: +d[state.cols.stress],
            job: String(d[state.cols.occupation]).trim(),
            quality: state.cols.quality ? +d[state.cols.quality] : null,
            age: state.cols.age ? +d[state.cols.age] : null,
            activity: state.cols.activity ? +d[state.cols.activity] : null,
            activityRaw: d[state.cols.activity], // Keep raw for Sankey processing
            heartRate: state.cols.heartRate ? +d[state.cols.heartRate] : NaN,

        }))
        .filter((d) => isFinite(d.sleep) && isFinite(d.stress) && d.job);

    // 3. Aggregated Job Data for Bubble Chart
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

    // 4. Data for Sankey Diagram (flow.js logic)
    const { label: actLabel } = buildActivityMapper(state.data.map(d=>d.activityRaw));

    state.flowData = state.data.map(d => ({
        sleepHours: d.sleep,
        sleepQuality: d.quality,
        activity: actLabel(d.activityRaw),
        sleepBucket: sleepBucket(d.quality),
        heartRate: isFinite(d.heartRate) ? d.heartRate : NaN
    }));

    state.flowGraph = buildSankeyGraph(state.flowData);

    // 5. Initialize UI
    populateKeyFacts();
    generateInsights();
    initVisualization(); // This will now call renderBubbleChart and renderSankey

    let resizeTimer;
    window.addEventListener("resize", () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            initVisualization();
        }, 250);
    });
}).catch(err => {
    console.error(err);
    // Add a general error message for both viz containers
    d3.selectAll("#mainViz, #flowViz").append("div")
        .style("color","#ff6b6b").style("padding","12px")
        .text("Failed to load or process data. Check console for details.");
});


// ----- KEY FACTS & INSIGHTS (main.js logic) -----

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


// ----- VISUALIZATION INITIALIZATION (Combined) -----

function initVisualization() {
    renderBubbleChart();
    renderSankey(state.flowGraph);
}


// ----- BUBBLE CHART (main.js logic) -----

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

    // Axes, Grids, and Labels (omitted for brevity, but exist in original main.js)
    // ... [Your original main.js code for axes, grids, and labels goes here] ...
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
    // --- END AXES ---

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

    // Initial selection update (to clear panel if resized)
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

            updateJobDetailPanel(selectedJobData); // Renamed function
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
                .text("Select an element to see details"); // Generic placeholder

            d3.select("#detailContent").html("");
        }
    }

    function updateJobDetailPanel(jobData) {
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


// ----- SANKEY DIAGRAM (flow.js logic) -----

function buildSankeyGraph(rows){
    const grouped = d3.rollup(
        rows,
        v => ({ value:v.length, records:v }),
        d => d.activity,
        d => d.sleepBucket
    );

    const nodeSet = new Set();
    const linksTmp = [];
    for (const [a, sub] of grouped.entries()) {
        nodeSet.add(a);
        for (const [b, obj] of sub.entries()) {
            nodeSet.add(b);
            linksTmp.push({ source:a, target:b, value:obj.value, records:obj.records });
        }
    }
    const nodes = Array.from(nodeSet, name => ({ name }));
    const idx   = new Map(nodes.map((d,i)=>[d.name,i]));
    const links = linksTmp.map(l => ({ source: idx.get(l.source), target: idx.get(l.target), value:l.value, records:l.records }));
    return { nodes, links };
}

function renderSankey(graph){
    const host = d3.select("#flowViz");
    host.selectAll("*").remove();

    const width  = host.node().getBoundingClientRect().width || 900;
    const height = Math.max(520, Math.round(width*0.55));

    const svg = host.append("svg").attr("width", width).attr("height", height);

    const sankey = d3.sankey().nodeWidth(18).nodePadding(12).extent([[16,16],[width-16,height-16]]);
    const { nodes, links } = sankey({
        nodes: graph.nodes.map(d=>({...d})),
        links: graph.links.map(d=>({...d}))
    });

    // links
    svg.append("g").attr("fill","none")
        .selectAll("path")
        .data(links)
        .join("path")
        .attr("d", d3.sankeyLinkHorizontal())
        .attr("stroke", d => flowColorScale(nodes[d.source.index].name))
        .attr("stroke-width", d => Math.max(1, d.width))
        .attr("stroke-opacity", .28)
        .style("cursor","pointer")
        .on("mousemove", (ev,d)=> showTooltip(ev, d, "flow"))
        .on("mouseleave", hideTooltip)
        .on("click", (ev, d) => {
            svg.selectAll("path").attr("stroke-opacity", .28);
            d3.select(ev.currentTarget).attr("stroke-opacity", .85);
            updateFlowDetailPanel(d, {nodes,links}); // Renamed function
        });

    // nodes
    svg.append("g").selectAll("rect")
        .data(nodes)
        .join("rect")
        .attr("x", d=>d.x0).attr("y", d=>d.y0)
        .attr("width", d=>d.x1-d.x0).attr("height", d=>d.y1-d.y0)
        .attr("fill", d => d3.color(flowColorScale(d.name)))
        .attr("stroke", d => d3.color(flowColorScale(d.name)).darker(0.7));

    // labels
    svg.append("g")
        .style("font","12px DM Sans, system-ui, sans-serif")
        .selectAll("text")
        .data(nodes)
        .join("text")
        .attr("x", d => d.x0 < width/2 ? d.x1 + 6 : d.x0 - 6)
        .attr("y", d => (d.y0 + d.y1)/2)
        .attr("dy","0.35em")
        .attr("text-anchor", d => d.x0 < width/2 ? "start" : "end")
        .attr("fill","#cbd3eb")
        .text(d => `${d.name} (${d.value})`);

    // frame
    svg.append("rect")
        .attr("x",8).attr("y",8).attr("width", width-16).attr("height", height-16)
        .attr("rx",12).attr("fill","none").attr("stroke","#30363d");

    // Initial detail panel reset
    d3.select("#detailPanelFlow")
        .classed("hidden", true)
        .select("#detailTitleFlow")
        .text("Select an element to see details");
    d3.select("#detailContentFlow").html("");
}

function updateFlowDetailPanel(linkData, graph){
    const src = graph.nodes[linkData.source.index].name;
    const tgt = graph.nodes[linkData.target.index].name;
    const recs = linkData.records || [];
    const n = recs.length;

    d3.select("#detailPanelFlow").classed("hidden", false);
    d3.select("#detailTitleFlow").text(`${src} → ${tgt}`);

    if (!n) {
        d3.select("#detailContentFlow").html("<div class='detail-value'>No records in this flow.</div>");
        return;
    }

    const avgSleep   = d3.mean(recs, d => +d.sleepHours) || 0;
    const avgHR      = d3.mean(recs, d => +d.heartRate) || NaN;
    const avgQuality = d3.mean(recs, d => +d.sleepQuality) || 0;

    const clamp01 = x => Math.max(0, Math.min(1, x));
    const pSleep   = clamp01((avgSleep - 5) / (10 - 5));
    const pHR      = isFinite(avgHR) ? (1 - clamp01((avgHR - 50) / (100 - 50))) : 0.0;
    const pQuality = clamp01((avgQuality - 1) / (10 - 1));

    const row = (label, val, unit, pct, color) => `
    <div class="detail-stat">
      <div style="width:100%;">
        <div class="detail-label">${label}</div>
        <div class="detail-value">${Number.isFinite(val) ? val.toFixed(2) : "—"} ${unit||""}</div>
        <div class="detail-bar-container">
          <div class="detail-bar" style="width:${(pct*100).toFixed(0)}%; background:${color};"></div>
        </div>
      </div>
    </div>`;

    d3.select("#detailContentFlow").html(`
    <div class="detail-stat">
      <div class="detail-label">Sample Size</div>
      <div class="detail-value">${n} people</div>
    </div>
    <div class="detail-stat">
      <div class="detail-label">Activity Level</div>
      <div class="detail-value">${src}</div>
    </div>
    <div class="detail-stat">
      <div class="detail-label">Sleep Quality Bucket</div>
      <div class="detail-value">${tgt}</div>
    </div>
    ${row("Average Sleep Duration", avgSleep, "hours", pSleep, "#51cf66")}
    ${row("Average Heart Rate",    avgHR,   "bpm",   pHR,    "#7c4dff")}
    ${row("Sleep Quality Score",         avgQuality, "/ 10", pQuality, "#22b8cf")}
  `);
}