// Renders the live-sim chart from sim-data.json: the average of 30 simulated 600-minute
// workdays (GovernorSim seeds 1001-1030), no Opto + no governor vs Opto + cost governor.
// Each point carries the 30-day mean and the 10th/90th percentile across the 30 days.
(function () {
  var state = { metric: 'cost', view: 'cumulative' };
  var chart = null;
  var data = null;
  var summary = null;

  var fmtCost = function (v) {
    return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  var fmtTok = function (v) {
    if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M';
    if (v >= 1e3) return (v / 1e3).toFixed(1) + 'K';
    return String(Math.round(v));
  };

  // field name for a side ('f' or 'o') and a band ('' mean, 'Lo', 'Hi') in the current metric/view
  function field(side, band) {
    var m = state.metric === 'cost' ? 'Cost' : 'Tok';
    var v = state.view === 'cumulative' ? 'Cum' : 'Min';
    return side + v + m + band;
  }
  function series(side, band) {
    return data.map(function (r) { return r[field(side, band)]; });
  }

  function render() {
    if (!data) return;
    var labels = data.map(function (r) { return r.t; });
    var fMean = series('f', ''), oMean = series('o', '');
    var fmt = state.metric === 'cost' ? fmtCost : fmtTok;

    var fVal, oVal;
    if (state.view === 'rate') {
      fVal = Math.max.apply(null, fMean);
      oVal = Math.max.apply(null, oMean);
    } else {
      fVal = fMean[fMean.length - 1];
      oVal = oMean[oMean.length - 1];
    }
    var pctReduction = fVal > 0 ? ((fVal - oVal) / fVal * 100) : 0;
    // Full-day view: show the average of the 30 daily reductions (the headline figure), not the ratio of the two averages.
    if (state.view === 'cumulative' && summary) {
      pctReduction = state.metric === 'cost' ? summary.costReductionPct : summary.tokenReductionPct;
    }

    var unit = state.view === 'rate' ? (state.metric === 'cost' ? '/min peak' : '/min peak') : ' / day';
    document.getElementById('simFrontierVal').textContent = fmt(fVal) + unit;
    document.getElementById('simOptoVal').textContent = fmt(oVal) + unit;
    document.getElementById('simDeltaVal').textContent = pctReduction.toFixed(0) + '% lower';

    function band(side, color) {
      return [
        { label: 'band-lo', isBand: true, data: series(side, 'Lo'), borderWidth: 0, pointRadius: 0, fill: false, tension: 0.25 },
        { label: 'band-hi', isBand: true, data: series(side, 'Hi'), borderWidth: 0, pointRadius: 0, fill: '-1', backgroundColor: color, tension: 0.25 }
      ];
    }

    var datasets = []
      .concat(band('f', 'rgba(107, 114, 128, 0.18)'))
      .concat(band('o', 'rgba(0, 138, 208, 0.22)'))
      .concat([
        { label: 'No Opto, no governor (30-day average)', data: fMean, borderColor: '#9CA3AF', borderWidth: 2, pointRadius: 0, tension: 0.25, fill: false },
        { label: 'Opto + cost governor (30-day average)', data: oMean, borderColor: '#008ad0', borderWidth: 2.5, pointRadius: 0, tension: 0.25, fill: false }
      ]);

    var ctx = document.getElementById('simChart').getContext('2d');
    var cfg = {
      type: 'line',
      data: { labels: labels, datasets: datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            labels: {
              color: '#9CA3AF',
              font: { family: 'Inter' },
              filter: function (item, chartData) { return !chartData.datasets[item.datasetIndex].isBand; }
            }
          },
          tooltip: {
            filter: function (item) { return !item.dataset.isBand; },
            callbacks: {
              label: function (c) { return c.dataset.label + ': ' + fmt(c.parsed.y); }
            }
          }
        },
        scales: {
          x: {
            ticks: { color: '#6B7280', maxTicksLimit: 8, font: { family: 'JetBrains Mono', size: 10 } },
            grid: { color: 'rgba(255,255,255,0.04)' }
          },
          y: {
            beginAtZero: true,
            ticks: {
              color: '#6B7280',
              font: { family: 'JetBrains Mono', size: 10 },
              callback: function (v) { return fmt(v); }
            },
            grid: { color: 'rgba(255,255,255,0.06)' }
          }
        }
      }
    };

    if (chart) {
      chart.destroy();
    }
    chart = new Chart(ctx, cfg);
  }

  function wireToggles() {
    document.querySelectorAll('.sim-toggle[data-metric]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.sim-toggle[data-metric]').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        state.metric = btn.getAttribute('data-metric');
        render();
      });
    });
    document.querySelectorAll('.sim-toggle[data-view]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.sim-toggle[data-view]').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        state.view = btn.getAttribute('data-view');
        render();
      });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    wireToggles();
    fetch('sim-data.json')
      .then(function (r) { return r.json(); })
      .then(function (json) {
        data = Array.isArray(json) ? json : json.points;
        summary = Array.isArray(json) ? null : json.summary;
        render();
      })
      .catch(function (err) {
        var wrap = document.querySelector('.sim-chart-wrap');
        if (wrap) wrap.innerHTML = '<p style="color: var(--text-muted); text-align:center; padding: 40px 0;">Simulation data unavailable.</p>';
        console.error('sim-data.json failed to load', err);
      });
  });
})();
