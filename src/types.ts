/* eslint-disable @typescript-eslint/no-explicit-any,no-use-before-define */

export type $Config = {
  database: string;
  dialect?: 'mysql' | 'sqlite';
  host: string;
  logging?: boolean;
  password: string;
  port: string;
  storage?: string;
  username: string;
};

export type $Where<
MCC extends Record<MN, any>,
MN extends keyof MCC,
> = MCC[MN]['ModelQueryParams'] & {
  [key: string]: Record<string, unknown> | boolean | number | string | void;
};

type $IncludeInside<
MCC extends Record<MN, any>,
MCS extends Record<MN, any>,
MN extends keyof MCC,
> = {
  as?: string;
  model: MCS[MN];
  where: $Where<MCC, MN>;
} | MN;
export type $Include<
MCC extends Record<MN, any>,
MCS extends Record<MN, any>,
MN extends keyof MCC,
> = Array<
$IncludeInside<MCC, MCS, MN> | string
>;

export type $QueryParams<
MCC extends Record<MN, any>,
MCS extends Record<MN, any>,
MN extends keyof MCC,
> = {
  // attributes?: Array<$Keys<$ModelQueryParams<M>>>,
  attributes?: Array<string>;
  // include?: $Include<$Keys<$ModelAssociations<M>>>,
  include?: $Include<MCC, MCS, any>;
  where?: $Where<MCC, MN>;
};

export type $RequestContext = {
  method: string,
  request: Record<string, any>,
};
