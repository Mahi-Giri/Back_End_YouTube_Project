import { asyncHandler } from "../utils/asyncHandler.js";
import { apiError } from "../utils/apiError.js";
import { User } from "../models/user.models.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { apiResponse } from "../utils/apiResponse.js";

const registerUser = asyncHandler(async (req, res) => {
    // Controller with validation with defining Algorithms

    // get user detail from frontend
    const { username, email, fullname, password } = req.body;

    // validation - not empty
    // if (fullname === "") {
    //     throw new apiError(400, "Full name required");
    // }

    // if (username === "") {
    //     throw new apiError(400, "Username required");
    // }

    // if (email === "") {
    //     throw new apiError(400, "Email required");
    // }

    // if (password === "") {
    //     throw new apiError(400, "Password required");
    // }

    // Advance if block working same like above if block
    if (
        [username, email, fullname, password].some(
            (field) => field.trim() === ""
        )
    ) {
        throw new apiError(400, "All filed is required!!");
    }

    // check if user is already exist: username && email
    const existedUser = await User.findOne({
        $or: [{ username }, { email }],
    });

    if (existedUser) throw new apiError(409, "This user already exists");

    // check for images, check for avatar
    const avatarLocalPath = req.files?.avatar[0]?.path;
    const coverImageLocalPath = req.files?.coverImage[0]?.path;

    if (!avatarLocalPath) throw new apiError(400, "Missing avatar Image");

    // upload them to cloudinary, avatars
    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if (!avatar) throw new apiError(400, "Missing avatar image");

    // create user object and create entry in database
    const user = await User.create({
        fullname,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase(),
    });

    // remove password and refresh token from response
    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    );

    // check for user creation
    if (!createdUser)
        throw new apiError(500, "Something went wrong while creating user");

    // return response
    return res
        .status(200)
        .json(new apiResponse(200, createdUser, "User created successfully"));
});

export { registerUser };
