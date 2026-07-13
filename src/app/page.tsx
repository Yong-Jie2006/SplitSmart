"use client";

import { Check, CircleDollarSign, HandCoins, Plus, ReceiptText, Trash2, Users } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { requestGraphql } from "@/lib/graphql-client";

type Person = {
  id: string;
  name: string;
};

type Expense = {
  id: string;
  description: string;
  amountCents: number;
  paidBy: Person;
  createdAt: string;
  shares: Array<{ person: Person; amountCents: number }>;
};

type Balance = {
  person: Person;
  amountCents: number;
};

type Settlement = {
  from: Person;
  to: Person;
  amountCents: number;
};

type Dashboard = {
  people: Person[];
  expenses: Expense[];
  balances: Balance[];
  settlements: Settlement[];
};

const dashboardQuery = /* GraphQL */ `
  query Dashboard {
    people { id name }
    expenses {
      id description amountCents createdAt
      paidBy { id name }
      shares { person { id name } amountCents }
    }
    balances { person { id name } amountCents }
    settlements { from { id name } to { id name } amountCents }
  }
`;

const addPersonMutation = /* GraphQL */ `
  mutation AddPerson($name: String!) {
    addPerson(name: $name) { id name }
  }
`;

const addExpenseMutation = /* GraphQL */ `
  mutation AddExpense($input: AddExpenseInput!) {
    addExpense(input: $input) { id }
  }
`;

const deleteExpenseMutation = /* GraphQL */ `
  mutation DeleteExpense($id: ID!) {
    deleteExpense(id: $id) { id }
  }
`;

export default function Home() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingPerson, setIsAddingPerson] = useState(false);
  const [isAddingExpense, setIsAddingExpense] = useState(false);
  const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(null);
  const [personName, setPersonName] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [payerId, setPayerId] = useState("");
  const [participantIds, setParticipantIds] = useState<string[] | null>(null);

  async function refreshDashboard() {
    const nextDashboard = await requestGraphql<Dashboard>(dashboardQuery);
    setDashboard(nextDashboard);
  }

  useEffect(() => {
    let isCurrent = true;

    void requestGraphql<Dashboard>(dashboardQuery)
      .then((nextDashboard) => {
        if (isCurrent) {
          setDashboard(nextDashboard);
        }
      })
      .catch((reason: unknown) => {
        if (isCurrent) {
          setError(errorMessage(reason));
        }
      })
      .finally(() => {
        if (isCurrent) {
          setIsLoading(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  async function addPerson(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsAddingPerson(true);

    try {
      await requestGraphql(addPersonMutation, { name: personName });
      setPersonName("");
      await refreshDashboard();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setIsAddingPerson(false);
    }
  }

  async function addExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    let amountCents: number;
    try {
      amountCents = moneyToCents(amount);
    } catch (reason) {
      setError(errorMessage(reason));
      return;
    }

    setIsAddingExpense(true);
    try {
      await requestGraphql(addExpenseMutation, {
        input: {
          description,
          amountCents,
          paidByPersonId: selectedPayerId,
          participantIds: selectedParticipantIds,
        },
      });
      setDescription("");
      setAmount("");
      await refreshDashboard();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setIsAddingExpense(false);
    }
  }

  async function deleteExpense(expenseId: string) {
    setError(null);
    setDeletingExpenseId(expenseId);

    try {
      await requestGraphql(deleteExpenseMutation, { id: expenseId });
      await refreshDashboard();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setDeletingExpenseId(null);
    }
  }

  function toggleParticipant(personId: string) {
    setParticipantIds((current) => {
      const selected = current ?? people.map((person) => person.id);
      return selected.includes(personId)
        ? selected.filter((id) => id !== personId)
        : [...selected, personId];
    });
  }

  const people = dashboard?.people ?? [];
  const selectedParticipantIds = (participantIds ?? people.map((person) => person.id)).filter((id) =>
    people.some((person) => person.id === id),
  );
  const selectedPayerId = people.some((person) => person.id === payerId)
    ? payerId
    : (people[0]?.id ?? "");
  const canAddExpense = people.length > 0 && selectedParticipantIds.length > 0;

  return (
    <main className="min-h-screen bg-muted/40">
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-1 text-sm font-medium text-muted-foreground">Shared expenses, simplified</p>
            <h1 className="text-3xl font-bold tracking-tight">SplitSmart</h1>
          </div>
          <p className="text-sm text-muted-foreground">All amounts are in Malaysian ringgit (RM).</p>
        </header>

        {error ? (
          <div className="mb-6 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">
            {error}
          </div>
        ) : null}

        {isLoading ? (
          <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">Loading your group…</div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <section className="rounded-xl border bg-card p-5 shadow-sm">
              <SectionTitle icon={<Users />} title="People" subtitle="Add everyone sharing expenses." />
              <form className="mt-5 flex gap-2" onSubmit={addPerson}>
                <input
                  className={inputClassName}
                  value={personName}
                  onChange={(event) => setPersonName(event.target.value)}
                  placeholder="e.g. Ali"
                  maxLength={100}
                  required
                  aria-label="Person name"
                />
                <Button type="submit" disabled={isAddingPerson}>
                  <Plus /> {isAddingPerson ? "Adding" : "Add"}
                </Button>
              </form>
              <ul className="mt-5 divide-y rounded-lg border">
                {people.length ? people.map((person) => (
                  <li key={person.id} className="flex items-center gap-3 px-3 py-3 text-sm font-medium">
                    <span className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-xs text-primary">
                      {initials(person.name)}
                    </span>
                    {person.name}
                  </li>
                )) : (
                  <li className="px-3 py-6 text-center text-sm text-muted-foreground">Add your first person to begin.</li>
                )}
              </ul>
            </section>

            <section className="rounded-xl border bg-card p-5 shadow-sm">
              <SectionTitle icon={<ReceiptText />} title="Add an expense" subtitle="Every expense is split equally among selected people." />
              <form className="mt-5 space-y-4" onSubmit={addExpense}>
                <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
                  <label className="grid gap-1.5 text-sm font-medium">
                    Description
                    <input className={inputClassName} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="e.g. Dinner" maxLength={200} required disabled={!people.length} />
                  </label>
                  <label className="grid gap-1.5 text-sm font-medium">
                    Amount (RM)
                    <input className={inputClassName} value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" inputMode="decimal" required disabled={!people.length} />
                  </label>
                </div>

                <label className="grid gap-1.5 text-sm font-medium">
                  Paid by
                  <select className={inputClassName} value={selectedPayerId} onChange={(event) => setPayerId(event.target.value)} disabled={!people.length}>
                    {people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
                  </select>
                </label>

                <fieldset className="grid gap-2">
                  <legend className="text-sm font-medium">Split between</legend>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {people.map((person) => (
                      <label key={person.id} className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted">
                        <input type="checkbox" checked={selectedParticipantIds.includes(person.id)} onChange={() => toggleParticipant(person.id)} disabled={!people.length} />
                        {person.name}
                      </label>
                    ))}
                  </div>
                  {!people.length ? <p className="text-sm text-muted-foreground">Add at least one person before recording an expense.</p> : null}
                </fieldset>

                <Button type="submit" className="w-full" size="lg" disabled={!canAddExpense || isAddingExpense}>
                  <Plus /> {isAddingExpense ? "Saving expense…" : "Add expense"}
                </Button>
              </form>
            </section>

            <section className="rounded-xl border bg-card p-5 shadow-sm">
              <SectionTitle icon={<CircleDollarSign />} title="Balances" subtitle="Positive means they should receive money." />
              <div className="mt-5 space-y-3">
                {dashboard?.balances.length ? dashboard.balances.map((balance) => (
                  <div key={balance.person.id} className="flex items-center justify-between rounded-lg border px-3 py-3">
                    <span className="font-medium">{balance.person.name}</span>
                    <span className={balance.amountCents > 0 ? "font-semibold text-emerald-700" : balance.amountCents < 0 ? "font-semibold text-rose-700" : "font-semibold text-muted-foreground"}>
                      {balance.amountCents > 0 ? "+" : ""}{formatMoney(balance.amountCents)}
                    </span>
                  </div>
                )) : <EmptyState message="Balances will appear after your first expense." />}
              </div>
            </section>

            <section className="rounded-xl border bg-card p-5 shadow-sm">
              <SectionTitle icon={<HandCoins />} title="Settle up" subtitle="The fewest payments needed to clear all balances." />
              <div className="mt-5 space-y-3">
                {dashboard?.settlements.length ? dashboard.settlements.map((settlement, index) => (
                  <div key={`${settlement.from.id}-${settlement.to.id}-${index}`} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-3 text-sm">
                    <span><strong>{settlement.from.name}</strong> pays <strong>{settlement.to.name}</strong></span>
                    <span className="shrink-0 font-semibold">{formatMoney(settlement.amountCents)}</span>
                  </div>
                )) : <EmptyState icon={<Check className="size-4" />} message={dashboard?.expenses.length ? "Everyone is settled up." : "Settlement suggestions will appear after expenses are added."} />}
              </div>
            </section>

            <section className="rounded-xl border bg-card p-5 shadow-sm lg:col-span-2">
              <SectionTitle icon={<ReceiptText />} title="Expense history" subtitle="Saved in Neon and split exactly to the cent." />
              <div className="mt-5 divide-y rounded-lg border">
                {dashboard?.expenses.length ? dashboard.expenses.map((expense) => (
                  <article key={expense.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="font-medium">{expense.description}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">Paid by {expense.paidBy.name} · Split between {expense.shares.map((share) => share.person.name).join(", ")}</p>
                    </div>
                    <div className="flex items-start gap-3 text-left sm:text-right">
                      <div>
                        <p className="font-semibold">{formatMoney(expense.amountCents)}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{new Date(expense.createdAt).toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" })}</p>
                      </div>
                      <AlertDialog>
                        <AlertDialogTrigger
                          type="button"
                          className="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                          aria-label={`Delete ${expense.description}`}
                        >
                          <Trash2 className="size-4" />
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogTitle className="text-lg font-semibold">Delete “{expense.description}”?</AlertDialogTitle>
                          <AlertDialogDescription className="mt-2 text-sm leading-6 text-muted-foreground">
                            This permanently removes the expense and its split details. Balances and settlement suggestions will be recalculated.
                          </AlertDialogDescription>
                          <div className="mt-6 flex justify-end gap-3">
                            <AlertDialogCancel disabled={deletingExpenseId === expense.id}>Cancel</AlertDialogCancel>
                            <Button
                              type="button"
                              variant="destructive"
                              disabled={deletingExpenseId === expense.id}
                              onClick={() => deleteExpense(expense.id)}
                            >
                              <Trash2 /> {deletingExpenseId === expense.id ? "Deleting…" : "Delete expense"}
                            </Button>
                          </div>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </article>
                )) : <EmptyState message="No expenses recorded yet." />}
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}

function SectionTitle({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 text-primary">{icon}</span>
      <div>
        <h2 className="font-semibold">{title}</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}

function EmptyState({ icon, message }: { icon?: React.ReactNode; message: string }) {
  return <p className="flex items-center justify-center gap-2 px-3 py-7 text-center text-sm text-muted-foreground">{icon}{message}</p>;
}

function moneyToCents(value: string): number {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (!match) {
    throw new Error("Enter an amount such as 10 or 10.50.");
  }

  const wholeRinggit = Number(match[1]);
  const cents = Number((match[2] ?? "").padEnd(2, "0"));
  const amountCents = wholeRinggit * 100 + cents;

  if (!Number.isSafeInteger(amountCents) || amountCents <= 0 || amountCents > 2_147_483_647) {
    throw new Error("Enter an amount greater than zero.");
  }

  return amountCents;
}

function formatMoney(amountCents: number): string {
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
  }).format(amountCents / 100);
}

function initials(name: string): string {
  return name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

function errorMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : "Something went wrong. Please try again.";
}

const inputClassName = "h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50";
