// Helpers
import {
  Op,
  Sequelize,
} from 'sequelize';
import _ from 'lodash';
import pluralize from 'pluralize';
import {
  baseErrorKey,
  CustomError,
} from '@vroskus/library-error';
import helpers from './helpers';

// Types
import type {
  $Config,
  $Include,
  $QueryParams,
  $RequestContext,
  $Where,
} from './types';

import type {
  $Helpers,
} from './helpers';

type $RequestContextListener = (arg0: $RequestContext) => unknown;
type $SetRequestContextListenerParams = { listener: $RequestContextListener };
type $SetRequestContextListenerResponse = void;

export * from './types';

class DatabaseService<C extends $Config, MC extends {
  Config: any;
  Models: any;
  Classes: any;
  Shapes: any;
}> {
  models: MC['Classes'];

  helpers: $Helpers;

  stack: Sequelize;

  Op: typeof Op;

  requestContextListener: $RequestContextListener;

  constructor({
    database,
    dialect,
    host,
    logging,
    password,
    port,
    storage,
    username,
  }: C, modelShapes: MC['Shapes']) {
    const dbConfig = {
      database,
      define: {
        charset: 'utf8',
        dialectOptions: {
          collate: 'utf8_general_ci',
        },
        timestamps: true,
      },
      dialect: dialect || 'mysql',
      dialectOptions: {
      },
      host,
      logging,
      password,
      port: Number(port),
      storage,
      username,
    };

    const stack = new Sequelize(
      dbConfig.database,
      dbConfig.username,
      dbConfig.password,
      dbConfig,
    );

    // Init models
    const models: MC['Classes'] = _.mapValues(
      modelShapes,
      (f) => f(
        Sequelize,
        stack,
        helpers,
      ),
    );

    // Init models associations
    Object.keys(models).forEach((modelName: keyof MC['Classes']) => {
      if (models[modelName].associate) {
        models[modelName].associate(models);
      }

      if (models[modelName].hooks) {
        models[modelName].hooks(models);
      }
    });

    this.models = models;

    this.helpers = helpers;

    this.stack = stack;

    this.Op = Op;

    this.requestContextListener = () => {};
  }

  async setupTestEnvironment(): Promise<void> {
    await this.stack.sync({
      force: true,
    });
  }

  setRequestContextListener({
    listener,
  }: $SetRequestContextListenerParams): $SetRequestContextListenerResponse {
    this.requestContextListener = listener;
  }

  // getModel private method
  #getModel<MN extends keyof MC['Config']>({
    modelName,
  }: {
    modelName: MN;
  }): MC['Classes'][MN] {
    if (!_.has(
      this.models,
      modelName,
    )) {
      throw new CustomError(
        'Invalid model name',
        baseErrorKey.invalidModelNameError,
        {
          data: {
            modelName,
          },
        },
      );
    }

    return _.get(
      this.models,
      modelName,
    );
  }

  // getModelInstance private method
  async #getModelInstance<MN extends keyof MC['Config']>({
    id,
    modelName,
  }: {
    modelName: MN;
    id: string;
  }): Promise<MC['Models'][MN]> {
    const model = this.#getModel({
      modelName,
    });

    const modelInstance = await model.findByPk(id);

    if (modelInstance === null) {
      throw new CustomError(
        'Record was not found',
        baseErrorKey.entityNotFoundError,
        {
          data: {
            id,
            modelName,
          },
        },
      );
    }

    return modelInstance;
  }

  // mapQueryAssociations private method
  #mapQueryAssociations<MN extends keyof MC['Config']>({
    include: includeInput,
    where: whereInput,
  }: {
    where: $Where<MC['Config'], MN>;
    include: $Include<MC['Config'], MC['Classes'], MN>;
  }): {
      where: $Where<MC['Config'], MN>;
      as?: string;
      include: $Include<MC['Config'], MC['Classes'], MN>;
    } {
    let where = _.clone(whereInput);

    const include = _.clone(includeInput);

    _.forOwn(
      where,
      (value: string, key: string) => {
        if (key.includes('.')) {
          const associationName = key.substr(
            0,
            key.indexOf('.'),
          );
          const param = key.substr(key.indexOf('.') + 1);

          const model = this.models[pluralize.singular(associationName)];

          if (model) {
            include.push({
              as: associationName,
              model,
              ...this.#mapQueryAssociations({
                include: [],
                where: {
                  [param]: value,
                },
              }),
            });
          } else {
            include.push(associationName);
          }

          where = _.omit(
            where,
            [key],
          );
        }
      },
    );

    return {
      include,
      where,
    };
  }

  // prepareQueryParams private method
  #prepareQueryParams<MN extends keyof MC['Config']>({
    params,
  }: {
    params: $QueryParams<MC['Config'], MC['Classes'], MN>;
  }): $QueryParams<MC['Config'], MC['Classes'], MN> {
    const preparedParams = {
      attributes: params.attributes,
      include: params.include,
      where: undefined,
    };

    if (params.where) {
      const {
        include,
        where,
      } = this.#mapQueryAssociations({
        include: _.get(
          preparedParams,
          'include',
          [],
        ),
        where: params.where,
      });

      preparedParams.where = where;
      preparedParams.include = include;
    }

    return preparedParams;
  }

  // associate private method
  async #associate({
    action,
    associationModelId,
    associationModelName,
    id,
    modelName,
    pivot,
  }: {
    action: 'add' | 'remove';
    modelName: keyof MC['Config'];
    id: string;
    associationModelName: keyof MC['Config'];
    associationModelId: string;
    pivot?: Record<string, unknown>;
  }) {
    const actionMethod = `${action}${String(associationModelName)}`;

    const modelInstance = await this.#getModelInstance({
      id,
      modelName,
    });

    const associationModel = await this.#getModelInstance({
      id: associationModelId,
      modelName: associationModelName,
    });

    const pivotData = pivot ? {
      through: pivot,
    } : {
    };

    if (typeof modelInstance[actionMethod] !== 'function') {
      throw new CustomError(
        'Association action method not found',
        baseErrorKey.associationActionMethodNotFoundError,
        {
          data: {
            action,
            associationModelId,
            associationModelName,
            id,
            modelName,
            pivot,
          },
        },
      );
    }

    return modelInstance[actionMethod](
      associationModel,
      pivotData,
    );
  }

  // getOne method
  async getOne<MN extends keyof MC['Config']>(request: {
    modelName: MN;
    params: $QueryParams<MC['Config'], MC['Classes'], MN>;
  }): Promise<MC['Models'][MN] | null> {
    this.requestContextListener({
      method: 'getOne',
      request,
    });

    const {
      modelName,
      params,
    } = request;
    const model = this.#getModel({
      modelName,
    });
    const queryParams = this.#prepareQueryParams({
      params,
    });
    const modelInstances = await model.findAll(queryParams);

    // If more then one record found
    if (modelInstances.length > 1) {
      throw new CustomError(
        'Multiple records found',
        baseErrorKey.multipleRecordsFoundError,
        {
          data: {
            amount: modelInstances.length,
            modelName,
            request,
          },
        },
      );
    }

    return _.head(modelInstances) || null;
  }

  // getFirst method
  async getFirst<MN extends keyof MC['Config']>(request: {
    modelName: MN;
    params: $QueryParams<MC['Config'], MC['Classes'], MN>;
  }): Promise<MC['Models'][MN] | null> {
    this.requestContextListener({
      method: 'getFirst',
      request,
    });

    const {
      modelName,
      params,
    } = request;
    const model = this.#getModel({
      modelName,
    });
    const queryParams = this.#prepareQueryParams({
      params,
    });
    const modelInstances = await model.findAll(queryParams);

    return _.first(modelInstances) || null;
  }

  // getLast method
  async getLast<MN extends keyof MC['Config']>(request: {
    modelName: MN;
    params: $QueryParams<MC['Config'], MC['Classes'], MN>;
  }): Promise<MC['Models'][MN] | null> {
    this.requestContextListener({
      method: 'getLast',
      request,
    });

    const {
      modelName,
      params,
    } = request;
    const model = this.#getModel({
      modelName,
    });
    const queryParams = this.#prepareQueryParams({
      params,
    });
    const modelInstances = await model.findAll(queryParams);

    return _.last(modelInstances) || null;
  }

  // getMany method
  async getMany<MN extends keyof MC['Config']>(request: {
    modelName: MN;
    params: $QueryParams<MC['Config'], MC['Classes'], MN>;
  }): Promise<Array<MC['Models'][MN]>> {
    this.requestContextListener({
      method: 'getMany',
      request,
    });

    const {
      modelName,
      params,
    } = request;
    const model = this.#getModel({
      modelName,
    });

    const queryParams = this.#prepareQueryParams({
      params,
    });

    return model.findAll(queryParams);
  }

  // createOne method
  async createOne<MN extends keyof MC['Config']>(request: {
    modelName: MN;
    params: MC['Config'][MN]['ModelCreateParams'];
  }): Promise<MC['Models'][MN]> {
    this.requestContextListener({
      method: 'createOne',
      request,
    });

    const {
      modelName,
      params,
    } = request;
    const model = this.#getModel({
      modelName,
    });

    const attributes = _.clone(params);

    return model.create(attributes);
  }

  // createBundle method
  async createBundle<MN extends keyof MC['Config']>(request: {
    modelName: MN;
    params: MC['Config'][MN]['ModelCreateParams'];
    include: $Include<MC['Config'], MC['Classes'], MN>;
  }): Promise<MC['Models'][MN]> {
    this.requestContextListener({
      method: 'createBundle',
      request,
    });

    const {
      include,
      modelName,
      params,
    } = request;
    const model = this.#getModel({
      modelName,
    });

    const attributes = _.clone(params);

    return model.create(
      attributes,
      {
        include,
      },
    );
  }

  // createMany method
  async createMany<MN extends keyof MC['Config']>(request: {
    modelName: MN;
    params: Array<MC['Config'][MN]['ModelCreateParams']>;
  }): Promise<Array<MC['Models'][MN]>> {
    this.requestContextListener({
      method: 'createMany',
      request,
    });

    const {
      modelName,
      params,
    } = request;
    const model = this.#getModel({
      modelName,
    });

    const attributes = _.clone(params);

    return model.bulkCreate(attributes);
  }

  // upsertOne method
  async upsertOne<MN extends keyof MC['Config']>(request: {
    modelName: MN;
    params: MC['Config'][MN]['ModelUpsertParams'] | MC['Models'][MN];
    where: $Where<MC['Config'], MN>;
  }): Promise<MC['Models'][MN]> {
    this.requestContextListener({
      method: 'upsertOne',
      request,
    });

    const {
      modelName,
      params,
      where,
    } = request;
    const attributes = _.omit(
      params,
      ['id', 'createdAt', 'updatedAt'],
    );

    const model = this.#getModel({
      modelName,
    });

    const queryParams = this.#prepareQueryParams({
      params: {
        where,
      },
    });
    const modelInstances = await model.findAll(queryParams);

    if (modelInstances.length > 1) {
      throw new CustomError(
        'Multiple records found',
        baseErrorKey.multipleRecordsFoundError,
        {
          data: {
            amount: modelInstances.length,
            modelName,
            request,
          },
        },
      );
    }

    if (modelInstances.length === 0) {
      return model.create(attributes);
    }

    if (typeof modelInstances[0].update === 'function') {
      return modelInstances[0].update(attributes);
    }

    return modelInstances[0];
  }

  // updateOne method
  async updateOne<MN extends keyof MC['Config']>(request: {
    modelName: MN;
    params: MC['Config'][MN]['ModelUpdateParams'] | MC['Models'][MN];
  }): Promise<MC['Models'][MN]> {
    this.requestContextListener({
      method: 'updateOne',
      request,
    });

    const {
      modelName,
      params,
    } = request;
    const {
      // @ts-ignore
      id,
    } = params;

    const modelInstance = await this.#getModelInstance({
      id,
      modelName,
    });

    const attributes: MC['Config'][MN]['ModelUpdateParams'] = _.omit(
      params,
      ['id', 'createdAt', 'updatedAt'],
    );

    if (typeof modelInstance.update === 'function') {
      await modelInstance.update(attributes);
    }

    return modelInstance;
  }

  // toggleOne method
  async toggleOne<MN extends keyof MC['Config']>(request: {
    modelName: MN;
    where: $Where<MC['Config'], MN>;
  }): Promise<MC['Models'][MN]> {
    this.requestContextListener({
      method: 'toggleOne',
      request,
    });

    const {
      modelName,
      where,
    } = request;
    const attributes = _.omit(
      where,
      ['id', 'createdAt', 'updatedAt'],
    );

    const model = this.#getModel({
      modelName,
    });

    const queryParams = this.#prepareQueryParams({
      params: {
        where,
      },
    });
    let modelInstance = await model.findOne(queryParams);

    if (modelInstance !== null) {
      await modelInstance.destroy();
    } else {
      modelInstance = await model.create(attributes);
    }

    return modelInstance;
  }

  // deleteOne method
  async deleteOne<MN extends keyof MC['Config']>(request: {
    modelName: MN;
    params: $QueryParams<MC['Config'], MC['Classes'], MN>;
  }): Promise<MC['Models'][MN]> {
    this.requestContextListener({
      method: 'deleteOne',
      request,
    });

    const {
      modelName,
      params,
    } = request;
    const model = this.#getModel({
      modelName,
    });
    const queryParams = this.#prepareQueryParams({
      params,
    });
    const modelInstances = await model.findAll(queryParams);

    // If more then one record found
    if (modelInstances.length > 1) {
      throw new CustomError(
        'Multiple records found',
        baseErrorKey.multipleRecordsFoundError,
        {
          data: {
            amount: modelInstances.length,
            modelName,
            request,
          },
        },
      );
    }

    if (modelInstances.length === 0) {
      throw new CustomError(
        'Record was not found',
        baseErrorKey.entityNotFoundError,
        {
          data: {
            modelName,
            request,
          },
        },
      );
    }

    await modelInstances[0].destroy();

    return modelInstances[0];
  }

  // deleteMany method
  async deleteMany<MN extends keyof MC['Config']>(request: {
    modelName: MN;
    params: $QueryParams<MC['Config'], MC['Classes'], MN>;
  }): Promise<Array<MC['Models'][MN]>> {
    this.requestContextListener({
      method: 'deleteMany',
      request,
    });

    const {
      modelName,
      params,
    } = request;
    const model = this.#getModel({
      modelName,
    });
    const queryParams = this.#prepareQueryParams({
      params,
    });
    const modelInstances = await model.findAll(queryParams);

    for (let index = 0; index < modelInstances.length; index += 1) {
      if (modelInstances[index].destroy) {
        await modelInstances[index].destroy();
      }
    }

    return modelInstances;
  }

  // sync method
  async sync<MN extends keyof MC['Config'], AM extends keyof MC['Config']>(request: {
    modelName: MN;
    params: {
      items: Array<MC['Config'][MN]['ModelUpsertParams']>;
      associationModelName: AM;
      associationModelId: string;
    };
  }): Promise<{
      createdItemIds: Array<string>;
      deletedItemIds: Array<string>;
      syncedItems: Array<MC['Models'][MN]>;
      updatedItemIds: Array<string>;
    }> {
    this.requestContextListener({
      method: 'sync',
      request,
    });

    const {
      modelName,
      params: {
        associationModelId,
        associationModelName,
        items,
      },
    } = request;
    const actions: Array<Promise<MC['Models'][MN]>> = [];
    const where = {
      [`${String(associationModelName)}Id`]: associationModelId,
    };

    const model = this.#getModel({
      modelName,
    });

    this.#getModel({
      modelName: associationModelName,
    });

    const presentItems = await model.findAll({
      where,
    });

    const presentItemIds: Array<string> = _.map(
      presentItems,
      'id',
    );

    const updatedItemIds: Array<string> = _.map(
      _.filter(
        items,
        (item) => item.id,
      ),
      'id',
    );

    const deletedItemIds: Array<string> = _.without(
      presentItemIds,
      ...updatedItemIds,
    );

    const createdItemIds: Array<string> = [];
    const syncedItems: Array<MC['Models'][MN]> = [];

    items.forEach((item) => {
      const updateRequest = {
        modelName,
        params: {
          ...item,
          ...where,
        },
        where: {
          id: item.id || null,
        },
      };

      const action = (async () => {
        const upsertedItem = await this.upsertOne(updateRequest);

        if (!item.id) {
          createdItemIds.push(upsertedItem.id);
        }

        syncedItems.push(upsertedItem);
      })();

      actions.push(action);
    });

    deletedItemIds.forEach((id: string) => {
      const deleteRequest = {
        modelName,
        params: {
          where: {
            id,
            ...where,
          },
        },
      };

      const action = this.deleteOne(deleteRequest);

      actions.push(action);
    });

    await Promise.all(actions);

    return {
      createdItemIds,
      deletedItemIds,
      syncedItems,
      updatedItemIds,
    };
  }

  // addAssociation method
  async addAssociation<MN extends keyof MC['Config'], AM extends keyof MC['Config']>(request: {
    modelName: MN;
    params: {
      id: string;
      associationModelName: AM;
      associationModelId: string;
      pivot?: Record<string, unknown>;
    };
  }): Promise<MC['Models'][MN]> {
    this.requestContextListener({
      method: 'addAssociation',
      request,
    });

    const {
      modelName,
      params: {
        associationModelId,
        associationModelName,
        id,
        pivot,
      },
    } = request;

    const result = await this.#associate({
      action: 'add',
      associationModelId,
      associationModelName,
      id,
      modelName,
      pivot,
    });

    if (!result || (result && result.length !== 1)) {
      throw new CustomError(
        'Already associatied records',
        baseErrorKey.alreadyAssociatedRecordsError,
        {
          data: {
            model1: modelName,
            model1id: id,
            model2: associationModelName,
            model2id: associationModelId,
          },
        },
      );
    }

    return result[0];
  }

  // removeAssociation method
  async removeAssociation<MN extends keyof MC['Config'], AM extends keyof MC['Config']>(request: {
    modelName: MN;
    params: {
      id: string;
      associationModelName: AM;
      associationModelId: string;
      pivot?: Record<string, unknown>;
    };
  }): Promise<boolean> {
    this.requestContextListener({
      method: 'removeAssociation',
      request,
    });

    const {
      modelName,
      params: {
        associationModelId,
        associationModelName,
        id,
      },
    } = request;

    const result = await this.#associate({
      action: 'remove',
      associationModelId,
      associationModelName,
      id,
      modelName,
    });

    if (!result || (result && result !== 1)) {
      throw new CustomError(
        'Not associatied records',
        baseErrorKey.notAssociatedRecordsError,
        {
          data: {
            model1: modelName,
            model1id: id,
            model2: associationModelName,
            model2id: associationModelId,
          },
        },
      );
    }

    return true;
  }

  // syncAssociations method
  async syncAssociations<MN extends keyof MC['Config'], AM extends keyof MC['Config']>(request: {
    modelName: MN;
    params: {
      id: string;
      associationModelName: AM;
      associationModelIds: Array<string>;
    };
  }): Promise<{
      addedAssociationModelIds: Array<string>;
      removedAssociationModelIds: Array<string>;
    }> {
    this.requestContextListener({
      method: 'syncAssociations',
      request,
    });

    const {
      modelName,
      params: {
        associationModelIds,
        associationModelName,
        id,
      },
    } = request;
    const actions: Array<Promise<MC['Models'][MN]>> = [];
    const pluralAssociationModelName = pluralize.plural(associationModelName);

    const model = this.#getModel({
      modelName,
    });

    const modelInstance = await model.findOne({
      include: [pluralAssociationModelName],
      where: {
        id,
      },
    });

    const presentAssociationModelIds: Array<string> = _.map(
      _.get(
        modelInstance,
        pluralAssociationModelName,
        [],
      ),
      'id',
    );

    const addAssociationModelIds = _.without(
      associationModelIds,
      ...presentAssociationModelIds,
    );

    addAssociationModelIds.forEach((associationModelId: string) => {
      const addAssociationRequest = {
        modelName,
        params: {
          associationModelId,
          associationModelName,
          id,
        },
      };

      const action = this.addAssociation(addAssociationRequest);

      actions.push(action);
    });

    const removeAssociationModelIds = _.without(
      presentAssociationModelIds,
      ...associationModelIds,
    );

    removeAssociationModelIds.forEach((associationModelId: string) => {
      const addAssociationRequest = {
        modelName,
        params: {
          associationModelId,
          associationModelName,
          id,
        },
      };

      const action = this.removeAssociation(addAssociationRequest);

      actions.push(action);
    });

    await Promise.all(actions);

    return {
      addedAssociationModelIds: addAssociationModelIds,
      removedAssociationModelIds: removeAssociationModelIds,
    };
  }
}

export default DatabaseService;
