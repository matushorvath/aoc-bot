# Creating a Group for AoC

1. Create a new group. Group name should be `AoC YYYY Day DD`, e.g. `AoC 2016 Day 11`.

   ![](img/create-group/create-group.png)

1. Add `@AocElfBot` into the group.

   ![](img/create-group/add-bot.png)

1. In the "Manage group" menu, set "Chat history for new members" to "Visible".

   ![](img/create-group/manage-group.png)
   ![](img/create-group/edit-group-1.png)
   ![](img/create-group/visible-history.png)

1. In the same "Manage group" menu, select the list of members, right click on `@AocElfBot` and promote it to admin. Use default access rights for the bot.

   ![](img/create-group/edit-group-2.png)
   ![](img/create-group/promote-admin.png)
   ![](img/create-group/add-admin.png)

1. If everything goes well, the bot will set up the new group and create a pinned message with the leaderboard.

   ![](img/create-group/bot-online.png)

If the bot stops working in a group for any reason, it is generally safe to demote it to regular user and promote it back to admin. This will re-initialize the bot for this group.
