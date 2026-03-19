using Microsoft.AspNetCore.Mvc;
using DrawGuessGame.DTOs;
using DrawGuessGame.Services;

namespace DrawGuessGame.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly IAuthService _authService;

        public AuthController(IAuthService authService)
        {
            _authService = authService;
        }

        [HttpPost("register")]
        public async Task<ActionResult<AuthResponse>> Register(RegisterRequest request)
        {
            var result = await _authService.Register(request);

            if (result == null)
            {
                return BadRequest(new { message = "Kullanıcı adı veya email zaten kullanımda" });
            }

            return Ok(result);
        }

        [HttpPost("login")]
        public async Task<ActionResult<AuthResponse>> Login(LoginRequest request)
        {
            var result = await _authService.Login(request);

            if (result == null)
            {
                return Unauthorized(new { message = "Kullanıcı adı/email veya şifre hatalı" });
            }

            return Ok(result);
        }
    }
}

