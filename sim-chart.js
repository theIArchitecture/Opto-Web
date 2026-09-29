// Renders the live-sim chart from sim-data.json — real per-minute output from a full
// 600-minute GovernorSim workday run (Frontier Unmanaged vs Opto PID), no synthetic data.
(function () {
  var state = { metric: 'cost', view: 'cumulative' };
  var chart = null;
  var data = null;

  var fmtCost = function (v) {
    return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  var fmtTok = function (v) {
    if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M';
    if (v >= 1e3) return (v / 1e3).toFixed(1) + 'K';
    return String(v);
  };

  function seriesFor(rows, side) {
    if (state.metric === 'cost') {
      return rows.map(function (r) { return state.view === 'cumulative' ? r[side + 'CumCost'] : r[side + 'MinCost']; });
    }
    return rows.map(function (r) { return state.view === 'cumulative' ? r[side + 'CumTok'] : r[side + 'MinTok']; });
  }

  function render() {
    if (!data) return;
    var labels = data.map(function (r) { return r.t; });
    var fSeries = seriesFor(data, 'f');
    var oSeries = seriesFor(data, 'o');
    var fmt = state.metric === 'cost' ? fmtCost : fmtTok;

    var last = data[data.length - 1];
    var fVal, oVal;
    if (state.view === 'rate') {
      fVal = Math.max.apply(null, fSeries);
      oVal = Math.max.apply(null, oSeries);
    } else {
      fVal = state.metric === 'cost' ? last.fCumCost : last.fCumTok;
      oVal = state.metric === 'cost' ? last.oCumCost : last.oCumTok;
    }
    var pctReduction = fVal > 0 ? ((fVal - oVal) / fVal * 100) : 0;

    document.getElementById('simFrontierVal').textContent = fmt(fVal) + (state.view === 'rate' ? ' peak/min' : ' / day');
    document.getElementById('simOptoVal').textContent = fmt(oVal) + (state.view === 'rate' ? ' peak/min' : ' / day');
    document.getElementById('simDeltaVal').textContent = pctReduction.toFixed(0) + '% lower';

    var ctx = document.getElementById('simChart').getContext('2d');
    var cfg = {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Frontier (Unmanaged)',
            data: fSeries,
            borderColor: '#6B7280',
            backgroundColor: 'rgba(107, 114, 128, 0.08)',
            borderWidth: 2,
            pointRadius: 0,
            tension: 0.25,
            fill: state.view === 'cumulative'
          },
          {
            label: 'Opto (PID-Governed)',
            data: oSeries,
            borderColor: '#008ad0',
            backgroundColor: 'rgba(0, 138, 208, 0.14)',
            borderWidth: 2.5,
            pointRadius: 0,
            tension: 0.25,
            fill: state.view === 'cumulative'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            labels: { color: '#9CA3AF', font: { family: 'Inter' } }
          },
          tooltip: {
            callbacks: {
              label: function (ctx) { return ctx.dataset.label + ': ' + fmt(ctx.parsed.y); }
            }
          }
        },
        scales: {
          x: {
            ticks: { color: '#6B7280', maxTicksLimit: 8, font: { family: 'JetBrains Mono', size: 10 } },
            grid: { color: 'rgba(255,255,255,0.04)' }
          },
          y: {
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
      chart.data = cfg.data;
      chart.options = cfg.options;
      chart.update();
    } else {
      chart = new Chart(ctx, cfg);
    }
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
        data = json;
        render();
      })
      .catch(function (err) {
        var wrap = document.querySelector('.sim-chart-wrap');
        if (wrap) wrap.innerHTML = '<p style="color: var(--text-muted); text-align:center; padding: 40px 0;">Simulation data unavailable.</p>';
        console.error('sim-data.json failed to load', err);
      });
  });
})();
