import { asyncHandler } from "../utils/asyncHandler.js";
import { apiError } from "../utils/apiError.js";
import { User } from "../models/user.models.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { apiResponse } from "../utils/apiResponse.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

const generateAccessRefreshToken = async (userId) => {
    try {
        const user = await User.findById(userId);
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false });

        return { accessToken, refreshToken };
    } catch (error) {
        throw new apiError(
            500,
            "Something went wrong when generating refresh and access token"
        );
    }
};

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

const loginUser = asyncHandler(async (req, res) => {
    // Take data from Request-Body
    const { email, username, password } = req.body;

    // Username and email based login
    if (!email && !username)
        throw new apiError(400, "Invalid username or email provided");

    // if (!(email || username))
    //     throw new apiError(400, "Invalid username or email provided");

    // find the user
    const user = await User.findOne({
        $or: [{ username }, { email }],
    });

    if (!user) throw new apiError(400, "User does not exist");

    // check password
    const isPasswordValid = await user.isPasswordCorrect(password);

    if (!isPasswordValid) throw new apiError(401, "Invalid User credentials");

    // access and refresh token
    const { accessToken, refreshToken } = await generateAccessRefreshToken(
        user._id
    );

    const loggedInUser = await User.findById(user._id).select(
        "-password -refreshToken"
    );

    // send cookies
    const option = {
        httpOnly: true,
        secure: true,
    };

    return res
        .status(200)
        .cookie("accessToken", accessToken, option)
        .cookie("refreshToken", refreshToken, option)
        .json(
            new apiResponse(
                200,
                {
                    user: loggedInUser,
                    accessToken,
                    refreshToken,
                },
                "User logged in successfully"
            )
        );
});

const logoutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: 1,
            },
        },
        {
            new: true,
        }
    );
    const option = {
        httpOnly: true,
        secure: true,
    };

    return res
        .status(200)
        .clearCookie("accessToken", option)
        .clearCookie("refreshToken", option)
        .json(new apiResponse(200, {}, "User logout successfully "));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken =
        req.cookies.refreshToken || req.body.refreshToken;

    // console.log(incomingRefreshToken);

    if (!incomingRefreshToken) throw new apiError(401, "unauthorized request");

    try {
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        );

        const user = await User.findById(decodedToken?._id);

        if (!user) throw new apiError(401, "Invalid refresh token");

        if (incomingRefreshToken !== user?.refreshToken)
            throw new apiError(401, "Refresh token is expired");

        const options = {
            httpOnly: true,
            secure: true,
        };

        const { accessToken, newRefreshToken } =
            await generateAccessRefreshToken(user._id);

        return res
            .status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", newRefreshToken, options)
            .json(
                new apiResponse(
                    200,
                    {
                        accessToken,
                        refreshToken: newRefreshToken,
                    },
                    "Refresh token refreshed successfully"
                )
            );
    } catch (error) {
        throw new apiError(401, error?.message || "Invalid refresh token");
    }
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body;

    const user = await User.findById(req.user?._id);

    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);
    if (!isPasswordCorrect) throw new apiError(400, "Invalid password");

    user.password = newPassword;
    await user.save({ validateBeforeSave: true });

    return res
        .status(200)
        .json(new apiResponse(200, {}, "Password changed successfully"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
    return res
        .status(200)
        .json(new apiResponse(200, req.user, "Current user fetched"));
});

const updateAccountDetails = asyncHandler(async (req, res) => {
    const { fullname, email } = req.body;

    if (!(fullname && email))
        throw new apiError(400, "FullName and Email is required ");

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullname,
                email,
            },
        },
        { new: true }
    ).select("-password");

    return res
        .status(200)
        .json(new apiResponse(200, user, "Account details updated"));
});

const updateUserAvatar = asyncHandler(async (req, res) => {
    const avatarLocalPath = req.file?.path;

    if (!avatarLocalPath) throw new apiError(400, "Avatar File not found");

    const avatar = await uploadOnCloudinary(avatarLocalPath);

    if (!avatar.url)
        throw new apiError(400, "Error while uploading avatar file");

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                avatar: avatar.url,
            },
        },
        { new: true }
    ).select("-password");

    return res.status(200).json(new apiResponse(200, user, "avatar updated"));
});

const updateUserCoverImage = asyncHandler(async (req, res) => {
    const coverImageLocalPath = req.file?.path;

    if (!coverImageLocalPath) throw new apiError(400, "Cover Image not found");

    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if (!coverImage.url)
        throw new apiError(400, "Error while uploading Cover Image file");

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                coverImage: coverImage.url,
            },
        },
        { new: true }
    ).select("-password");

    return res.status(200).json(200, user, "Cover Image updated");
});

const getUserChannelProfile = asyncHandler(async (req, res) => {
    const { username } = req.params;

    if (!username?.trim()) throw new apiError(400, "User not found");

    const channel = await User.aggregate([
        {
            $match: {
                username: username?.toLowerCase(),
            },
        },
        {
            $lookup: {
                from: "Subscription",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers",
            },
        },
        {
            $lookup: {
                from: "Subscription",
                localField: "_id",
                foreignField: "subscribers",
                as: "subscribedTo",
            },
        },
        {
            $addFields: {
                subscribersCount: {
                    $size: "$subscribers",
                },
                channelSubscribedToCount: {
                    $size: "$subscribedTo",
                },
                isSubscribed: {
                    $cond: {
                        if: {
                            $in: [req.user?._id, "$subscribers.subscriber"],
                        },
                        then: true,
                        else: false,
                    },
                },
            },
        },
        {
            $project: {
                fullname: 1,
                username: 1,
                email: 1,
                avatar: 1,
                coverImage: 1,
                subscribersCount: 1,
                channelSubscribedToCount: 1,
                isSubscribed: 1,
            },
        },
    ]);

    if (!channel?.length) throw new apiError(400, "Channel not exists");

    return res
        .status(200)
        .json(new apiResponse(200, channel[0], "User channel fetched"));
});

const getWatchHistory = asyncHandler(async (req, res) => {
    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user?._id),
            },
        },
        {
            $lookup: {
                from: "Video",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline: [
                    {
                        $lookup: {
                            from: "user",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [
                                {
                                    $project: {
                                        fullname: 1,
                                        username: 1,
                                        avatar: 1,
                                    },
                                },
                            ],
                        },
                    },
                    {
                        $addFields: {
                            owner: {
                                $first: "$owner",
                            },
                        },
                    },
                ],
            },
        },
    ]);

    return res
        .status(200)
        .json(
            new apiResponse(200, user[0].watchHistory, "Watch History Fetched")
        );
});

export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
    getWatchHistory,
};
