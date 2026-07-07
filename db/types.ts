import type { client } from "./client";

type DbClient = typeof client;
type DbTransaction = Parameters<Parameters<DbClient["transaction"]>[0]>[0];
export type DbLike = DbClient | DbTransaction;
