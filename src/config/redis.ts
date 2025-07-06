import Redis from "ioredis";
import { Service } from "typedi";
import { config } from "./env";

@Service()
export class RedisConfig {
  private static instance: Redis | undefined;

  public static getClient(): Redis {
    if (!RedisConfig.instance) {
      RedisConfig.instance = RedisConfig.createClient();
    }
    return RedisConfig.instance;
  }

  private static createClient(): Redis {
    const redisOptions = {
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      retryStrategy: (times: number): number => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
    };

    const client = new Redis(redisOptions);

    client.on("connect", () => {
      // Silent connection - logged by CacheService
    });

    client.on("error", (error) => {
      console.error("Redis connection error:", error);
    });

    client.on("close", () => {
      // Connection closed silently
    });

    return client;
  }

  public static async disconnect(): Promise<void> {
    if (RedisConfig.instance && RedisConfig.instance.status === "ready") {
      await RedisConfig.instance.disconnect();
      RedisConfig.instance = undefined;
    }
  }
}
