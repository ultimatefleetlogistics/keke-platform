import { authenticateApiRequest, apiError } from "@/lib/api/auth";
import { getInvestorPaymentHistory } from "@/lib/data/investor";

/**
 * Module 39: the mobile Payment History screen's data source, GET only,
 * takes optional `from`/`to` query params (`YYYY-MM-DD` or any string
 * `Date` can parse) so a filter or a specific month can narrow the
 * result instead of always returning everything `getInvestorPaymentHistory`
 * has. Same auth and 403 shape as `GET /api/v1/investor/summary`, which
 * returns a capped 6-entry preview of the same underlying data, this
 * route is where "the rest of it" lives once the mobile app needs more
 * than a preview.
 */
export async function GET(request: Request) {
  const user = await authenticateApiRequest(request);
  if (!user) return apiError(401, "Not signed in.");

  if (!user.investor) {
    return apiError(403, "This account isn't set up as an investor.");
  }

  const url = new URL(request.url);
  const fromParam = url.searchParams.get("from");
  const toParam = url.searchParams.get("to");

  const from = fromParam ? new Date(fromParam) : undefined;
  if (from && Number.isNaN(from.getTime())) {
    return apiError(400, "That 'from' date isn't valid.");
  }
  const to = toParam ? new Date(toParam) : undefined;
  if (to && Number.isNaN(to.getTime())) {
    return apiError(400, "That 'to' date isn't valid.");
  }

  const payments = await getInvestorPaymentHistory(user.investor, { from, to });
  return Response.json({ payments });
}
