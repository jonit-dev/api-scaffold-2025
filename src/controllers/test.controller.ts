import { Get, JsonController, Param } from "routing-controllers";
import { Service } from "typedi";
import {
  BadRequestException as BadRequest,
  NotFoundException as NotFound,
  UnauthorizedException as Unauthorized,
  ForbiddenException as Forbidden,
  InternalServerErrorException as InternalServerError,
  ConflictException as Conflict,
  UnprocessableEntityException as UnprocessableEntity,
} from "@exceptions/http-exceptions";
import { HttpStatus } from "@common-types/http-status";

@Service()
@JsonController("/test")
export class TestController {
  @Get("/400")
  test400(): never {
    throw new BadRequest("Bad Request - Test endpoint");
  }

  @Get("/401")
  test401(): never {
    throw new Unauthorized("Unauthorized - Test endpoint");
  }

  @Get("/403")
  test403(): never {
    throw new Forbidden("Forbidden - Test endpoint");
  }

  @Get("/404")
  test404(): never {
    throw new NotFound("Not Found - Test endpoint");
  }

  @Get("/409")
  test409(): never {
    throw new Conflict("Conflict - Test endpoint");
  }

  @Get("/422")
  test422(): never {
    throw new UnprocessableEntity("Unprocessable Entity - Test endpoint");
  }

  @Get("/500")
  test500(): never {
    throw new InternalServerError("Internal Server Error - Test endpoint");
  }

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
