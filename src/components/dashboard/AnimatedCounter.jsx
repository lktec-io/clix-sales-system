// Renders the formatted value immediately — no count-up animation, so
// figures are readable the instant data arrives. The name and props are
// unchanged for existing callers.
function AnimatedCounter({ value, formatter = (v) => v }) {
  return <span>{formatter(Number(value) || 0)}</span>;
}

export default AnimatedCounter;
