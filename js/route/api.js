
/**
 * Stubbed routing: returns a straight path between two points.
 * Replace this in Step 4 with a call to your AWS Lambda shortest-ski-path.
 *
 * @param {{lat:number, lng:number}} start
 * @param {{lat:number, lng:number}} end
 * @returns {Promise<{ path: Array<{lat:number, lng:number}> }>}
 */
export async function routeSegment(start, end) {
  // In the real implementation you'll fetch() your Lambda here.
  // Keeping it async now so the call site won't change later.
  return { path: [ start, end ] };
}