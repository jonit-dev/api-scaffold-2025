import Redis from "ioredis";
import { Service } from "typedi";
import { config } from "./env";

@Service()
export class RedisConfig {
  private static instance: Redis;

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
      lazyConnect: true,
    };

    const client = new Redis(redisOptions);

    client.on("connect", () => {
      console.log("Redis connected successfully");
    });

    client.on("error", (error) => {
      console.error("Redis connection error:", error);
    });

    client.on("close", () => {
      console.log("Redis connection closed");
    });

    return client;
  }

  public static async disconnect(): Promise<void> {
    if (RedisConfig.instance) {
      await RedisConfig.instance.disconnect();
    }
  }
}
