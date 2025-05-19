import { RpcInterface } from '@metaplex-foundation/umi';

declare module '@metaplex-foundation/umi' {
  interface RpcInterface {
    getAssetsByCreator(
      params: Array<{
        creator: any;
        onlyVerified?: boolean;
        limit?: number;
      }>
    ): Promise<{
      items: Array<{
        content: {
          metadata: {
            symbol?: string;
          };
        };
        ownership: {
          owner: string;
        };
      }>;
    }>;
    getAssetsByGroup(params: { groupKey: string; groupValue: string; limit?: number }): Promise<{
      items: Array<{
        content: {
          metadata: {
            symbol?: string;
          };
        };
        ownership: {
          owner: string;
        };
      }>;
    }>;
    searchAssets(params: {
      owner?: string;
      limit?: number;
      displayOptions?: {
        showCollectionMetadata?: boolean;
      };
    }): Promise<{
      items: Array<{
        content: {
          metadata: {
            symbol?: string;
          };
        };
        ownership: {
          owner: string;
        };
      }>;
    }>;
    call(
      method: string,
      params: any
    ): Promise<{
      result: {
        items: Array<{
          content: {
            metadata: {
              symbol?: string;
            };
          };
          ownership: {
            owner: string;
          };
        }>;
      };
    }>;
  }

  interface Umi {
    das(): {
      searchAssets(params: {
        owner?: string;
        limit?: number;
        displayOptions?: {
          showCollectionMetadata?: boolean;
        };
      }): Promise<{
        items: Array<{
          content: {
            metadata: {
              symbol?: string;
            };
          };
          ownership: {
            owner: string;
          };
        }>;
      }>;
    };
  }
}
