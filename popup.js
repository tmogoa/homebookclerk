// popup.js
document.addEventListener("DOMContentLoaded", function () {
  // Load all meal data
  loadAndDisplayData();

  // Set up event listeners
  document
    .getElementById("apply-filters")
    .addEventListener("click", loadAndDisplayData);
  document
    .getElementById("clear-filters")
    .addEventListener("click", clearFilters);
  document
    .getElementById("date-range")
    .addEventListener("change", toggleCustomDateRange);
  document.getElementById("export-csv").addEventListener("click", exportToCSV);
  document.getElementById("clear-data").addEventListener("click", clearAllData);

  // Toggle custom date range inputs
  function toggleCustomDateRange() {
    const customRange = document.getElementById("custom-range");
    customRange.style.display =
      document.getElementById("date-range").value === "custom"
        ? "block"
        : "none";
  }

  // Clear all filters
  function clearFilters() {
    document.getElementById("person-filter").value = "all";
    document.getElementById("date-range").value = "all";
    document.getElementById("custom-range").style.display = "none";
    loadAndDisplayData();
  }

  // Clear all stored data
  function clearAllData() {
    if (confirm("Are you sure you want to clear all collected data?")) {
      chrome.storage.local.remove("mealData", function () {
        loadAndDisplayData();
      });
    }
  }

  // Main function to load and display data
  function loadAndDisplayData() {
    chrome.storage.local.get(["mealData", "mealOptions"], function (result) {
      const mealData = result.mealData || {};
      const mealOptions = result.mealOptions;

      // Apply filters
      const filteredData = applyFilters(mealData);

      // Update people dropdown if needed
      updatePeopleDropdown(mealData);

      // Display summary statistics
      displaySummaryStats(filteredData, mealOptions);

      displayWeekendStats(filteredData, mealOptions);

      // Display detailed table
      displayDetailedTable(filteredData, mealOptions);
    });
  }

  // Apply selected filters to data
  function applyFilters(mealData) {
    const personFilter = document.getElementById("person-filter").value;
    const dateRangeFilter = document.getElementById("date-range").value;

    let filteredData = {};

    // Filter by date range
    let startDate = null;
    let endDate = null;

    if (dateRangeFilter === "custom") {
      const startInput = document.getElementById("start-date").value;
      const endInput = document.getElementById("end-date").value;

      if (startInput) startDate = new Date(startInput);
      if (endInput) endDate = new Date(endInput);
    } else if (dateRangeFilter === "current-month") {
      const now = new Date();
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    }

    // Apply date filter
    for (const dateStr in mealData) {
      const parts = dateStr.split(" ");
      const dateObj = new Date(`${parts[1]} ${parts[0]}, ${parts[2]}`);

      if (
        dateRangeFilter === "all" ||
        (startDate && endDate && dateObj >= startDate && dateObj <= endDate) ||
        (dateRangeFilter === "current-month" &&
          dateObj >= startDate &&
          dateObj <= endDate)
      ) {
        filteredData[dateStr] = mealData[dateStr];
      }
    }

    // If person filter is applied, filter the data further
    if (personFilter !== "all") {
      const personFilteredData = {};

      for (const dateStr in filteredData) {
        const dateData = filteredData[dateStr];

        if (dateData.meals[personFilter]) {
          personFilteredData[dateStr] = {
            date: dateData.date,
            meals: { [personFilter]: dateData.meals[personFilter] },
          };
        }
      }

      filteredData = personFilteredData;
    }

    return filteredData;
  }

  // Update the people dropdown with all names found
  function updatePeopleDropdown(mealData) {
    const dropdown = document.getElementById("person-filter");
    const currentValue = dropdown.value;

    // Clear existing options except "All People"
    while (dropdown.options.length > 1) {
      dropdown.remove(1);
    }

    // Get all unique person names
    const allPeople = new Set();

    for (const dateStr in mealData) {
      const people = Object.keys(mealData[dateStr].meals);
      people.forEach((person) => allPeople.add(person));
    }

    // Sort names alphabetically
    const sortedPeople = Array.from(allPeople).sort();

    // Add options to dropdown
    sortedPeople.forEach((person) => {
      const option = document.createElement("option");
      option.value = person;
      option.textContent = person;
      dropdown.appendChild(option);
    });

    // Restore previous selection if it exists
    if (sortedPeople.includes(currentValue)) {
      dropdown.value = currentValue;
    }
  }

  // Display summary statistics
  function displaySummaryStats(filteredData, mealOptions) {
    const statsDiv = document.getElementById("summary-stats");

    meals_ = {};

    mealOptions.forEach((option) => {
      meals_[option] = { total: 0, present: 0 };
    });

    // Count total entries and attendance stats
    const stats = {
      totalDays: Object.keys(filteredData).length,
      totalPeople: new Set(),
      meals: meals_,
      diets: {},
    };

    // Process each day
    for (const dateStr in filteredData) {
      const dateData = filteredData[dateStr];

      for (const person in dateData.meals) {
        stats.totalPeople.add(person);

        // Track diet info
        for (const meal in dateData.meals[person]) {
          const mealData = dateData.meals[person][meal];
          if (mealData.diet) {
            if (!stats.diets[mealData.diet]) {
              stats.diets[mealData.diet] = 0;
            }
            stats.diets[mealData.diet]++;
          }

          // Track meal stats
          if (stats.meals[meal]) {
            stats.meals[meal].total++;
            if (mealData.status === "accepted") {
              stats.meals[meal].present++;
            }
          }
        }
      }
    }

    // Build HTML for the stats
    let html = `
      <p>Total days: <strong>${stats.totalDays}</strong></p>
      <p>Total people: <strong>${stats.totalPeople.size}</strong></p>
      <p>Meal attendance:</p>
      <ul>
    `;

    for (const meal in stats.meals) {
      const mealStats = stats.meals[meal];
      const percentage =
        mealStats.total > 0
          ? Math.round((mealStats.present / mealStats.total) * 100)
          : 0;

      html += `<li>${meal}: ${mealStats.present}</li>`;
    }

    html += "</ul><p>Dietary requirements:</p><ul>";

    for (const diet in stats.diets) {
      html += `<li>${diet}: ${stats.diets[diet]} occurrences</li>`;
    }

    html += "</ul>";
    statsDiv.innerHTML = html;
  }

  function displayWeekendStats(filteredData, mealOptions) {
    const weekendStatsDiv = document.getElementById("weekend-stats");

    const personFilter = document.getElementById("person-filter").value;

    if (personFilter === "all") {
      weekendStatsDiv.innerHTML = "No person selected.";
      return;
    }

    let html = `<h4>Stats for ${personFilter}</h4>`;

    stats = {
      fri: {},
      sat: {},
      sun: {},
    };

    mealOptions.forEach((opt) => {
      for (day in stats) {
        stats[day][opt] = { count: 0 };
      }
    });

    for (const dateStr in filteredData) {
      const parts = dateStr.split(" ");
      const dateObj = new Date(`${parts[1]} ${parts[0]}, ${parts[2]}`);

      const bookings = filteredData[dateStr].meals[personFilter];

      /**
       * Friday
       * Look for any breakfast or packed lunch
       */
      if (dateObj.getDay() === 5) {
        lookFor = ["Breakfast", "Lunch-packed"];
        for (const booking in bookings) {
          let eligible = false;

          lookFor.forEach((elem) => {
            if (!eligible) eligible = booking.includes(elem);
          });

          if (eligible) stats["fri"][booking].count++;
        }
      }

      /**
       * Saturday
       * Pick everything
       */
      if (dateObj.getDay() === 6) {
        for (const booking in bookings) {
          if (mealOptions.includes(booking)) stats["sat"][booking].count++;
        }
      }

      /**
       * Sunday
       * Avoid any breakfast or packed lunch
       */
      if (dateObj.getDay() === 0) {
        lookFor = ["Lunch-normal", "Dinner-packed", "Dinner-normal"];

        for (const booking in bookings) {
          let eligible = false;

          lookFor.forEach((elem) => {
            if (!eligible) eligible = booking.includes(elem);
          });

          if (eligible) stats["sun"][booking].count++;
        }
      }
    }

    for (const day in stats) {
      daySummary = `<h5>${day}</h5>
      <ul>`;

      for (const meal in stats[day]) {
        const count = stats[day][meal].count
        if(count) daySummary += `<li>${meal}: ${count}</li>`;
      }
      daySummary += `</ul>`;

      html += daySummary;
    }

    console.log(html)

    weekendStatsDiv.innerHTML = html;
  }

  // Display detailed table
  function displayDetailedTable(filteredData, mealOptions) {
    const tableBody = document.getElementById("details-body");
    const tableHeader = document.getElementById("header");
    tableBody.innerHTML = "";
    tableHeader.innerHTML = `<th>Date</th>
        <th>Person</th>`;

    // Convert to a list of entries for easier sorting
    const entries = [];

    for (const dateStr in filteredData) {
      const dateData = filteredData[dateStr];

      for (const person in dateData.meals) {
        const personData = dateData.meals[person];

        const entry = {
          date: dateStr,
          person: person,
        };

        mealOptions.forEach((option) => {
          entry[option] = formatMealStatus(personData[option]);
        });

        entries.push(entry);
      }
    }

    // Sort by date then by person
    entries.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.person.localeCompare(b.person);
    });

    mealOptions.forEach((option) => {
      const col = document.createElement("th");
      col.innerHTML = option;
      tableHeader.appendChild(col);
    });

    // Add rows to table
    entries.forEach((entry) => {
      const row = document.createElement("tr");

      row.innerHTML = `
        <td>${entry.date}</td>
        <td>${entry.person}</td>
        `;

      mealOptions.forEach((option) => {
        row.innerHTML += `<td>${entry[option]}</td>`;
      });

      tableBody.appendChild(row);
    });

    // Show "no data" message if needed
    if (entries.length === 0) {
      const row = document.createElement("tr");
      row.innerHTML =
        '<td colspan="6" style="text-align: center;">No data matches the selected filters</td>';
      tableBody.appendChild(row);
    }
  }

  // Format meal status for display
  function formatMealStatus(mealData) {
    if (!mealData) return "✗";

    const status =
      mealData.status === "accepted"
        ? `✓ ${mealData.option || "present"}`
        : `✗ declined`;

    return status;
  }

  // Get the most common diet for a person
  function getMostCommonDiet(personData) {
    const diets = {};
    let maxCount = 0;
    let mostCommonDiet = "";

    for (const meal in personData) {
      if (personData[meal].diet) {
        const diet = personData[meal].diet;
        diets[diet] = (diets[diet] || 0) + 1;

        if (diets[diet] > maxCount) {
          maxCount = diets[diet];
          mostCommonDiet = diet;
        }
      }
    }

    return mostCommonDiet;
  }

  // Export data to CSV
  function exportToCSV() {
    chrome.storage.local.get(["mealData"], function (result) {
      const mealData = result.mealData || {};

      // Apply filters
      const filteredData = applyFilters(mealData);

      // Convert to CSV
      let csvContent = "data:text/csv;charset=utf-8,";
      csvContent += "Date,Person,Breakfast,Lunch,Dinner,Diet\n";

      for (const dateStr in filteredData) {
        const dateData = filteredData[dateStr];

        for (const person in dateData.meals) {
          const personData = dateData.meals[person];

          const breakfast = personData.Breakfast
            ? `${personData.Breakfast.status}:${
                personData.Breakfast.option || "-"
              }`
            : "N/A";

          const lunch = personData.Lunch
            ? `${personData.Lunch.status}:${personData.Lunch.option || "-"}`
            : "N/A";

          const dinner = personData.Dinner
            ? `${personData.Dinner.status}:${personData.Dinner.option || "-"}`
            : "N/A";

          const diet = getMostCommonDiet(personData);

          csvContent += `"${dateStr}","${person}","${breakfast}","${lunch}","${dinner}","${diet}"\n`;
        }
      }

      // Create download link
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", "meal_data.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
  }
});
