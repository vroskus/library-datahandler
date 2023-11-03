export type $Config = {
  database: string;
  dialect?: 'sqlite' | 'mysql';
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
  [key: string]: string | number | boolean | Record<string, any> | void;
};

type $IncludeInside<
MCC extends Record<MN, any>,
MCS extends Record<MN, any>,
MN extends keyof MCC,
> = MN | {
  model: MCS[MN];
  as?: string;
  where: $Where<MCC, MN>;
};
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
  where?: $Where<MCC, MN>;
  // attributes?: Array<$Keys<$ModelQueryParams<M>>>,
  attributes?: Array<string>;
  // include?: $Include<$Keys<$ModelAssociations<M>>>,
  include?: $Include<MCC, MCS, any>;
};

export type $RequestContext = {
  method: string,
  request: Record<string, any>,
};
