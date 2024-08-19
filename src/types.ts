/* eslint-disable @typescript-eslint/no-explicit-any,no-use-before-define */

interface $BaseConfig {
  logging?: boolean;
  timestamps?: boolean;
}

interface $MysqlConfig extends $BaseConfig {
  database: string;
  dialect: 'mysql';
  host: string;
  password: string;
  port: string;
  username: string;
}

interface $SqliteConfig extends $BaseConfig {
  dialect: 'sqlite';
  storage: string;
}

export type $Config = $MysqlConfig | $SqliteConfig;

export type $Where<
MCC extends Record<MN, any>,
MN extends keyof MCC,
> = {
  [key: string]: boolean | number | Record<string, unknown> | string | void;
} & MCC[MN]['ModelQueryParams'];

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
  limit?: number,
  offset?: number,
  where?: $Where<MCC, MN>;
};

export type $RequestContext = {
  method: string,
  request: Record<string, any>,
};
