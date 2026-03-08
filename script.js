const selectedCountries = [
  "United States",
  "China",
  "Germany",
  "India",
  "Ireland",
  "Norway",
  "United Kingdom",
  "Canada",
  "Australia",
  "Brazil"
];

const color = d3.scaleOrdinal()
  .domain(selectedCountries)
  .range(d3.schemeTableau10);

const tooltip = d3.select("#tooltip");

let fullData = [];
let currentMetric = "co2";
let highlightedCountry = "All";

d3.csv("data/combined_data.csv", d3.autoType).then(data => {
  fullData = data
    .filter(d =>
      selectedCountries.includes(d.country) &&
      d.year >= 1990 &&
      d.year <= 2022 &&
      d.co2 != null &&
      d.co2_per_capita != null &&
      d.renewable_share != null
    )
    .sort((a, b) => d3.ascending(a.year, b.year));

  populateCountryDropdown();
  setupMetricButtons();
  setupYearSlider();

  renderLineChart();
  renderScatterPlot(+d3.select("#yearSlider").property("value"));
});

function populateCountryDropdown() {
  const select = d3.select("#countrySelect");

  select.selectAll("option.country-option")
    .data(selectedCountries)
    .enter()
    .append("option")
    .attr("class", "country-option")
    .attr("value", d => d)
    .text(d => d);

  select.on("change", function () {
    highlightedCountry = this.value;
    renderLineChart();
  });
}

function setupMetricButtons() {
  d3.select("#totalBtn").on("click", () => {
    currentMetric = "co2";
    d3.select("#totalBtn").classed("active", true);
    d3.select("#perCapitaBtn").classed("active", false);
    renderLineChart();
  });

  d3.select("#perCapitaBtn").on("click", () => {
    currentMetric = "co2_per_capita";
    d3.select("#totalBtn").classed("active", false);
    d3.select("#perCapitaBtn").classed("active", true);
    renderLineChart();
  });
}

function setupYearSlider() {
  const years = [...new Set(fullData.map(d => d.year))];
  const minYear = d3.min(years);
  const maxYear = d3.max(years);

  d3.select("#yearSlider")
    .attr("min", minYear)
    .attr("max", maxYear)
    .attr("step", 1)
    .property("value", maxYear);

  d3.select("#yearValue").text(maxYear);

  d3.select("#yearSlider").on("input", function () {
    const year = +this.value;
    d3.select("#yearValue").text(year);
    renderScatterPlot(year);
  });
}

function renderLineChart() {
  d3.select("#lineChart").selectAll("*").remove();

  const margin = { top: 30, right: 180, bottom: 60, left: 80 };
  const width = 1000;
  const height = 500;

  const svg = d3.select("#lineChart")
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`);

  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const grouped = d3.groups(fullData, d => d.country);

  const x = d3.scaleLinear()
    .domain(d3.extent(fullData, d => d.year))
    .range([0, innerWidth]);

  const y = d3.scaleLinear()
    .domain([0, d3.max(fullData, d => d[currentMetric])])
    .nice()
    .range([innerHeight, 0]);

  const xAxis = d3.axisBottom(x).tickFormat(d3.format("d"));
  const yAxis = d3.axisLeft(y);

  g.append("g")
    .attr("class", "grid")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(xAxis.tickSize(-innerHeight));

  g.append("g")
    .attr("class", "grid")
    .call(yAxis.tickSize(-innerWidth));

  g.append("g")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(xAxis);

  g.append("g")
    .call(yAxis);

  svg.append("text")
    .attr("class", "axis-label")
    .attr("x", width / 2)
    .attr("y", height - 10)
    .attr("text-anchor", "middle")
    .text("Year");

  svg.append("text")
    .attr("class", "axis-label")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", 20)
    .attr("text-anchor", "middle")
    .text(currentMetric === "co2" ? "CO₂ emissions (tonnes)" : "CO₂ emissions per capita");

  const line = d3.line()
    .x(d => x(d.year))
    .y(d => y(d[currentMetric]));

  g.selectAll(".country-line")
    .data(grouped)
    .enter()
    .append("path")
    .attr("class", "country-line")
    .attr("fill", "none")
    .attr("stroke", d => color(d[0]))
    .attr("stroke-width", d => highlightedCountry === "All" || highlightedCountry === d[0] ? 2.5 : 1.5)
    .attr("opacity", d => highlightedCountry === "All" || highlightedCountry === d[0] ? 1 : 0.15)
    .attr("d", d => line(d[1]));

  const points = g.selectAll(".country-points")
    .data(grouped)
    .enter()
    .append("g");

  points.selectAll("circle")
    .data(d => d[1].map(v => ({ ...v, groupCountry: d[0] })))
    .enter()
    .append("circle")
    .attr("cx", d => x(d.year))
    .attr("cy", d => y(d[currentMetric]))
    .attr("r", d => highlightedCountry === "All" || highlightedCountry === d.country ? 3 : 2)
    .attr("fill", d => color(d.country))
    .attr("opacity", d => highlightedCountry === "All" || highlightedCountry === d.country ? 0.8 : 0.12)
    .on("mouseover", function (event, d) {
      tooltip
        .style("opacity", 1)
        .html(`
          <strong>${d.country}</strong><br>
          Year: ${d.year}<br>
          ${currentMetric === "co2" ? "CO₂" : "CO₂ per capita"}: ${formatValue(d[currentMetric], currentMetric)}
        `);
      d3.select(this).attr("r", 5);
    })
    .on("mousemove", function (event) {
      tooltip
        .style("left", `${event.pageX + 12}px`)
        .style("top", `${event.pageY - 28}px`);
    })
    .on("mouseout", function (event, d) {
      tooltip.style("opacity", 0);
      d3.select(this).attr("r", highlightedCountry === "All" || highlightedCountry === d.country ? 3 : 2);
    });

  const legend = svg.append("g")
    .attr("class", "legend")
    .attr("transform", `translate(${width - margin.right + 20}, ${margin.top})`);

  selectedCountries.forEach((country, i) => {
    const row = legend.append("g")
      .attr("transform", `translate(0, ${i * 20})`);

    row.append("rect")
      .attr("width", 12)
      .attr("height", 12)
      .attr("fill", color(country));

    row.append("text")
      .attr("x", 18)
      .attr("y", 10)
      .text(country);
  });
}

function renderScatterPlot(selectedYear) {
  d3.select("#scatterPlot").selectAll("*").remove();

  const margin = { top: 30, right: 40, bottom: 60, left: 80 };
  const width = 1000;
  const height = 500;

  const svg = d3.select("#scatterPlot")
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`);

  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const yearData = fullData.filter(d => d.year === selectedYear);

  const x = d3.scaleLinear()
    .domain([0, d3.max(yearData, d => d.renewable_share)])
    .nice()
    .range([0, innerWidth]);

  const y = d3.scaleLinear()
    .domain([0, d3.max(yearData, d => d.co2_per_capita)])
    .nice()
    .range([innerHeight, 0]);

  const xAxis = d3.axisBottom(x);
  const yAxis = d3.axisLeft(y);

  g.append("g")
    .attr("class", "grid")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(xAxis.tickSize(-innerHeight));

  g.append("g")
    .attr("class", "grid")
    .call(yAxis.tickSize(-innerWidth));

  g.append("g")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(xAxis);

  g.append("g")
    .call(yAxis);

  svg.append("text")
    .attr("class", "axis-label")
    .attr("x", width / 2)
    .attr("y", height - 10)
    .attr("text-anchor", "middle")
    .text("Renewable electricity share (%)");

  svg.append("text")
    .attr("class", "axis-label")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", 20)
    .attr("text-anchor", "middle")
    .text("CO₂ emissions per capita");

  g.selectAll("circle")
    .data(yearData)
    .enter()
    .append("circle")
    .attr("cx", d => x(d.renewable_share))
    .attr("cy", d => y(d.co2_per_capita))
    .attr("r", 6)
    .attr("fill", d => color(d.country))
    .attr("opacity", 0.85)
    .on("mouseover", function (event, d) {
      tooltip
        .style("opacity", 1)
        .html(`
          <strong>${d.country}</strong><br>
          Year: ${d.year}<br>
          Renewable share: ${d.renewable_share}%<br>
          CO₂ per capita: ${formatValue(d.co2_per_capita, "co2_per_capita")}
        `);
      d3.select(this).attr("r", 8);
    })
    .on("mousemove", function (event) {
      tooltip
        .style("left", `${event.pageX + 12}px`)
        .style("top", `${event.pageY - 28}px`);
    })
    .on("mouseout", function () {
      tooltip.style("opacity", 0);
      d3.select(this).attr("r", 6);
    });

  g.selectAll(".country-label")
    .data(yearData)
    .enter()
    .append("text")
    .attr("x", d => x(d.renewable_share) + 8)
    .attr("y", d => y(d.co2_per_capita) + 4)
    .style("font-size", "11px")
    .text(d => d.country);
}

function formatValue(value, metric) {
  if (metric === "co2") {
    return d3.format(",.2f")(value);
  }
  return d3.format(".2f")(value);
}