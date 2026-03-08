import { useCallback, useEffect, useRef } from 'react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';

const STORAGE_KEY = 'backtestTourCompleted';

function isCompleted() {
  return localStorage.getItem(STORAGE_KEY) === 'true';
}

export function useBacktestTour(chartRef) {
  const driverRef = useRef(null);

  useEffect(() => {
    return () => {
      driverRef.current?.destroy();
    };
  }, []);

  const handleBacktestComplete = useCallback(() => {
    const d = driverRef.current;
    if (!d || !d.isActive()) return;
    // Only auto-advance from the drag step (index 3)
    if (d.getActiveIndex() === 3) {
      // Wait for React to render BacktestResults
      setTimeout(() => d.moveNext(), 300);
    }
  }, []);

  const startTour = useCallback(() => {
    if (!chartRef?.current) return;

    driverRef.current?.destroy();

    const driverInstance = driver({
      showProgress: true,
      animate: true,
      overlayColor: 'black',
      overlayOpacity: 0.55,
      stagePadding: 8,
      stageRadius: 8,
      popoverClass: 'backtest-tour-popover',
      nextBtnText: 'Next',
      prevBtnText: 'Back',
      doneBtnText: 'Got it!',
      onDestroyed: () => {
        localStorage.setItem(STORAGE_KEY, 'true');
      },
      steps: [
        {
          element: '[data-tour="mode-toggle"]',
          popover: {
            title: 'Chart Modes',
            description:
              'Switch between <strong>Zoom</strong> and <strong>Backtest</strong> modes. Click Backtest to open the investment calculator.',
            side: 'top',
            align: 'center',
          },
        },
        {
          element: '[data-tour="backtest-amount"]',
          popover: {
            title: 'Investment Amount',
            description:
              'Enter how much you want to hypothetically invest. The backtest will calculate what this amount would be worth today.',
            side: 'top',
            align: 'center',
          },
          onHighlightStarted: () => {
            chartRef.current?.enterBacktestMode();
            return new Promise((resolve) => requestAnimationFrame(resolve));
          },
        },
        {
          element: '[data-tour="backtest-drip"]',
          popover: {
            title: 'Reinvest Dividends',
            description:
              'Enable <strong>DRIP</strong> to automatically reinvest dividends into more shares. This can significantly boost long-term returns.',
            side: 'top',
            align: 'center',
          },
        },
        {
          element: '[data-tour="chart-area"]',
          disableActiveInteraction: false,
          popover: {
            title: 'Try It — Drag to Select',
            description:
              'Now try it! <strong>Click and drag</strong> on the chart to select a time period. The tour will continue automatically.',
            side: 'top',
            align: 'center',
            showButtons: ['close'],
            onNextClick: () => {
              // Prevent manual Next — user must drag
            },
            onPrevClick: () => {
              // Prevent Back during interactive step
            },
          },
        },
        {
          element: '[data-tour="backtest-results"]',
          popover: {
            title: 'Your Results',
            description:
              'Here are your backtest results — total return, annualized performance, dividend income, and more. Adjust the investment amount or toggle DRIP to recalculate instantly.',
            side: 'top',
            align: 'center',
          },
        },
        {
          element: '[data-tour="backtest-clear"]',
          popover: {
            title: 'Start Over',
            description:
              'Click <strong>Clear</strong> to reset the backtest and select a different time period.',
            side: 'bottom',
            align: 'end',
          },
        },
      ],
    });

    driverRef.current = driverInstance;
    driverInstance.drive();
  }, [chartRef]);

  return { startTour, handleBacktestComplete, isCompleted: isCompleted() };
}
