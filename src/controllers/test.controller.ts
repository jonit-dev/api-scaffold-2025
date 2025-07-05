import { Get, JsonController, Param } from "routing-controllers";
import { Service } from "typedi";
import {
  BadRequest,
  NotFound,
  Unauthorized,
  Forbidden,
  InternalServerError,
  HttpStatus,
} from "../exceptions";

@Service()
@JsonController("/test")
export class TestController {
  @Get("/error/:type")
  testError(@Param("type") type: string): {
    message: string;
    availableTypes: string[];
    usage: string;
    statusCodes: Record<string, number>;
  } {
    switch (type) {
      case "badrequest":
        throw new BadRequest("This is a bad request error");

      case "notfound":
        throw new NotFound("Resource not found");

      case "unauthorized":
        throw new Unauthorized(
          "You are not authorized to access this resource",
        );

      case "forbidden":
        throw new Forbidden("Access forbidden");

      case "servererror":
        throw new InternalServerError("Something went wrong on the server");

      default:
        return {
          message: "Test error endpoint",
          availableTypes: [
            "badrequest",
            "notfound",
            "unauthorized",
            "forbidden",
            "servererror",
          ],
          usage: "GET /api/test/error/{type}",
          statusCodes: {
            badrequest: HttpStatus.BadRequest,
            notfound: HttpStatus.NotFound,
            unauthorized: HttpStatus.Unauthorized,
            forbidden: HttpStatus.Forbidden,
            servererror: HttpStatus.InternalServerError,
          },
        };
    }
  }
}
