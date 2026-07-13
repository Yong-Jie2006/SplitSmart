type GraphqlResponse<T> = {
  data?: T;
  errors?: Array<{ message: string }>;
};

export async function requestGraphql<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const response = await fetch("/api/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const body = (await response.json()) as GraphqlResponse<T>;

  if (!response.ok || body.errors?.length || !body.data) {
    throw new Error(body.errors?.map((error) => error.message).join(" ") || "Request failed.");
  }

  return body.data;
}
