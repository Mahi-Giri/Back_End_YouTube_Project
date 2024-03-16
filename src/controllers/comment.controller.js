import mongoose from "mongoose";
import { Comment } from "../models/comment.models.js";
import { apiError } from "../utils/apiError.js";
import { apiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { Video } from "../models/video.models.js";

const getVideoComments = asyncHandler(async (req, res) => {
    //TODO: get all comments for a video
    const { videoId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const video = await Video.findById(videoId);
    if (!video) throw new apiError(404, "Video not found");

    const commentAggregator = Comment.aggregate([
        {
            $match: {
                video: mongoose.Types.ObjectId(videoId),
            },
        },
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner",
            },
        },
        {
            $lookup: {
                from: "likes",
                localField: "_id",
                foreignField: "comment",
                as: "likes",
            },
        },
        {
            $addFields: {
                likeCount: {
                    $size: "$likes",
                },
                owner: {
                    $first: "$owner",
                },
                isLiked: {
                    $cond: {
                        if: {
                            $in: [req.user?._id, "$likes.likedBy"],
                        },
                        then: true,
                        else: false,
                    },
                },
            },
        },
        {
            $sort: {
                createdAt: -1,
            },
        },
        {
            $project: {
                content: 1,
                createdAt: 1,
                likeCount: 1,
                owner: {
                    username: 1,
                    fullname: 1,
                    "avatar.url": 1,
                },
                isLiked: 1,
            },
        },
    ]);

    const options = {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
    };

    const comments = await Comment.aggregatePaginate(
        commentAggregator,
        options
    );

    return res
        .status(200)
        .json(new apiResponse(200, comments, "Comments fetched successfully"));
});

const addComment = asyncHandler(async (req, res) => {
    // Get videoId and Content from frontend
    const { videoId } = req.params;
    const { content } = req.body;

    if (!content) throw new apiError(404, "Content is missing");

    // Get video based on id
    const video = await Video.findById(videoId);
    if (!video) throw new apiError(404, "Video not found");

    // Create a new comment
    const comment = await Comment.create({
        content,
        video: videoId,
        owner: req.user?._id,
    });

    if (!comment)
        throw new apiError(500, "failed to add comment please try again");

    return res
        .status(200)
        .json(new apiResponse(200, comment, "Comment created successfully "));
});

const updateComment = asyncHandler(async (req, res) => {
    // Get commentId and content from frontend
    const { commentId } = req.params;
    const { content } = req.body;

    if (!content) throw new apiError(404, "Content is missing");

    // Find comment which needs to be updated
    const comment = await Comment.findById(commentId);

    if (!comment) throw new apiError(404, "Comment not found");

    // Check the owner
    if (comment?.owner.toString() !== req?.user?._id.toString())
        throw new apiError(400, "Only owner can update comment");

    // Update comment
    const updatedComment = await Comment.findByIdAndUpdate(
        commentId,
        {
            $set: {
                content,
            },
        },
        { new: true }
    );

    if (!updatedComment)
        throw new apiError(500, "Failed to update comment please try again");

    // return response
    return Response.status(200).json(
        new apiResponse(200, updatedComment, "Comment updated")
    );
});

const deleteComment = asyncHandler(async (req, res) => {
    // Get commentId from frontend
    const { commentId } = req.params;
    if (!commentId) throw new apiError(400, "unable to get commentId");

    // Check comment using commentId
    const comment = await Comment.findById(commentId);
    if (!comment) throw new apiError(404, "Comment not found");

    // Check owner
    if (comment?.owner.toString() !== req.user?._id.toString())
        throw new apiError(400, "only owner can delete comment");

    // Delete comment
    const deletedComment = await Comment.findByIdAndDelete(comment);
    if (!deletedComment)
        throw new apiError(500, "Unable to delete comment please try again");

    await Like.deleteMany({
        comment: commentId,
        likedBy: req.user,
    });

    // return Response
    return res
        .status(200)
        .json(
            new apiResponse(200, deleteComment, "Comment deleted successfully")
        );
});

export { getVideoComments, addComment, updateComment, deleteComment };
